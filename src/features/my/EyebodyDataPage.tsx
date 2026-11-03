import { HardDrive, LockKeyhole, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Link } from 'react-router'
import { toast } from 'sonner'

import { AppIcon } from '@/components/common/AppIcon'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { Notice } from '@/components/common/Notice'
import { PageHeader } from '@/components/common/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { countPhotos, setVaultUser, wipeVault } from '@/lib/eyebodyVault'
import { useAuthStore } from '@/stores/authStore'

/** 눈바디 로컬 데이터 관리 — 사진은 서버로 보내지 않는다 (src/lib/eyebodyVault.ts: PBKDF2 + AES-GCM) */
export function EyebodyDataPage() {
  const [usage, setUsage] = useState<string | null>(null)
  const [count, setCount] = useState(0)
  const [confirm, setConfirm] = useState(false)
  const uid = useAuthStore((s) => s.account?.userId ?? null)
  useEffect(() => {
    setVaultUser(uid)
    countPhotos().then(setCount).catch(() => setCount(0))
  }, [uid])
  useEffect(() => {
    navigator.storage
      ?.estimate?.()
      .then((e) => setUsage(`${((e.usage ?? 0) / 1024 / 1024).toFixed(1)}MB / 약 ${Math.round((e.quota ?? 0) / 1024 / 1024 / 1024)}GB`))
      .catch(() => setUsage(null))
  }, [])

  return (
    <>
      <PageHeader title="눈바디 로컬 데이터" description="사진은 이 기기 브라우저에만 저장돼요" back="/my/data" />
      <div className="space-y-4 md:max-w-2xl">
        <Card className="space-y-4">
          <div className="flex items-center gap-3">
            <AppIcon icon={HardDrive} bg="soft" />
            <div className="flex-1">
              <p className="text-[15px] font-semibold">이 기기에 저장된 사진</p>
              <p className="text-[13px] text-text-muted">{count}장 · 브라우저 사용량 {usage ?? '확인 불가'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <AppIcon icon={LockKeyhole} bg="neutral" tone="muted" />
            <div className="flex-1">
              <p className="text-[15px] font-semibold">암호화 저장</p>
              <p className="text-[13px] text-text-muted">비밀번호로 사진마다 암호화 (PBKDF2 + AES-GCM)</p>
            </div>
            <Badge tone="success">사용 중</Badge>
          </div>
        </Card>
        <Notice tone="review" title="사진을 잃어버릴 수 있어요">
          브라우저 데이터를 지우거나 기기를 바꾸면 사진이 사라져요. 눈바디 비밀번호를 잊으면 복구할 수 없어요. 백업 기능은 발표 이후 계획이에요.
        </Notice>
        <div className="grid gap-2 sm:grid-cols-2">
          <Button asChild variant="outline" size="lg">
            <Link to="/record/eyebody">눈바디 열기</Link>
          </Button>
          <Button variant="outline" size="lg" disabled={count === 0} className="text-danger" onClick={() => setConfirm(true)}>
            <Trash2 size={18} strokeWidth={1.75} aria-hidden /> 사진 모두 삭제
          </Button>
        </div>
        {count === 0 && <p className="text-[12px] text-text-subtle">저장된 사진이 없어서 삭제 버튼이 꺼져 있어요.</p>}
        <ConfirmDialog
          open={confirm}
          onOpenChange={setConfirm}
          title="이 기기의 눈바디 사진을 모두 지울까요?"
          description="비밀번호와 사진이 모두 지워지고 되돌릴 수 없어요."
          confirmLabel="모두 삭제"
          tone="danger"
          onConfirm={async () => {
            await wipeVault()
            setCount(0)
            toast('눈바디 사진을 모두 지웠어요')
          }}
        />
      </div>
    </>
  )
}
