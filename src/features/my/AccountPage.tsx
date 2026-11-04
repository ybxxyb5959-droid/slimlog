import { Loader2 } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { PageHeader } from '@/components/common/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ProviderMark } from '@/features/auth/ProviderMark'
import type { ProviderId } from '@/features/auth/providers'
import { BottomSheet } from '@/components/common/BottomSheet'
import { api, apiReady, wakeServer } from '@/lib/api'
import { wipeVaultForUser } from '@/lib/eyebodyVault'
import { dbErrorMessage, isLive } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

const PROVIDER_NAME: Record<string, string> = { kakao: '카카오', google: 'Google', apple: 'Apple', naver: '네이버', email: '이메일(개발용)' }

export function AccountPage() {
  const navigate = useNavigate()
  const [withdraw, setWithdraw] = useState(false)
  const [busy, setBusy] = useState(false)
  const session = useAuthStore((s) => s.session)
  const provider = (isLive ? (session?.user.app_metadata.provider ?? 'email') : 'kakao') as string
  const email = isLive ? (session?.user.email ?? '이메일 정보 없음') : 'jiwon@example.com (예시)'
  return (
    <>
      <PageHeader title="연결된 로그인 계정" back="/my/settings" />
      <div className="space-y-4 md:max-w-2xl">
        <Card className="space-y-3">
          <h2 className="text-[15px] font-semibold">로그인 계정</h2>
          <div className="flex items-center gap-3">
            {provider in PROVIDER_NAME && provider !== 'email' && <ProviderMark provider={provider as ProviderId} className="size-9" />}
            <div className="flex-1">
              <p className="text-[15px]">{PROVIDER_NAME[provider] ?? provider}</p>
              <p className="text-[13px] text-text-muted">{email}</p>
            </div>
            <Badge tone="success">연결됨</Badge>
          </div>
        </Card>
        <Card className="space-y-2">
          <h2 className="text-[15px] font-semibold text-danger">회원 탈퇴</h2>
          <p className="text-[13px] leading-relaxed text-text-muted">
            탈퇴하면 서버에 저장된 모든 기록과 게시글, 이 기기에 저장된 눈바디 사진까지 함께 삭제돼요.
          </p>
          <Button variant="outline" className="mt-2 text-danger hover:bg-danger-soft hover:text-danger" onClick={() => {
              wakeServer()
              setWithdraw(true)
            }}
            disabled={(isLive && !apiReady) || busy}
          >
            회원 탈퇴
          </Button>
          {isLive && !apiReady && <p className="text-[12px] text-text-subtle">준비 중 · 탈퇴는 서버(FastAPI) 연결 후 열려요. 사진 파일까지 함께 지워야 해서 앱에서 바로 처리하지 않아요.</p>}
        </Card>
      </div>
      <ConfirmDialog
        open={withdraw}
        onOpenChange={setWithdraw}
        title="정말 탈퇴할까요?"
        description="모든 기록과 이 기기의 눈바디 사진이 삭제되고 되돌릴 수 없어요."
        confirmLabel="탈퇴"
        tone="danger"
        onConfirm={async () => {
          if (!isLive) {
            toast('목업: 탈퇴 처리 화면 (실제 삭제 없음)')
            return navigate('/login')
          }
          const userId = session?.user.id
          setBusy(true)
          try {
            await api('/me', { method: 'DELETE' }) // 서버: 사진 파일 → 계정 삭제 (기록은 함께 삭제)
            // 서버 삭제가 끝난 뒤에만 기기 데이터도 지운다 (실패하면 사진은 그대로 남아 있게)
            if (userId) {
              await wipeVaultForUser(userId).catch(() => {})
              clearUserLocalKeys(userId)
            }
            await useAuthStore.getState().signOut()
            toast('탈퇴했어요. 그동안 고마웠어요.')
            navigate('/login', { replace: true })
          } catch (e) {
            toast.error('탈퇴하지 못했어요', { description: (e as Error).message || dbErrorMessage(e) })
          } finally {
            setBusy(false)
          }
        }}
      />
      {/* 서버가 잠들어 있으면 첫 요청이 30초~1분 걸린다 → 눌러도 아무 일 없어 보이지 않게 */}
      <BottomSheet open={busy} onRequestClose={() => {}} title="탈퇴 처리 중이에요">
        <div className="flex items-center gap-3 pb-4 text-[14px] text-text-muted" role="status">
          <Loader2 size={20} className="shrink-0 animate-spin text-primary" aria-hidden />
          <p className="break-keep">기록과 사진을 지우고 있어요. 서버가 쉬고 있었다면 1분 정도 걸릴 수 있어요. 앱을 닫지 말아 주세요.</p>
        </div>
      </BottomSheet>
    </>
  )
}

/** 이 사용자 몫의 기기 저장값(즐겨찾기·안내 본 기록 등) 지우기 — 키에 사용자 id 가 들어 있는 것만 */
function clearUserLocalKeys(userId: string) {
  try {
    for (const k of Object.keys(localStorage)) if (k.includes(userId)) localStorage.removeItem(k)
  } catch {
    /* 저장소를 못 쓰는 환경이면 무시 */
  }
}
