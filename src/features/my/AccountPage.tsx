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
import { api, apiReady } from '@/lib/api'
import { dbErrorMessage, isLive } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

const PROVIDER_NAME: Record<string, string> = { kakao: '카카오', google: 'Google', apple: 'Apple', naver: '네이버', email: '이메일(개발용)' }

export function AccountPage() {
  const navigate = useNavigate()
  const [withdraw, setWithdraw] = useState(false)
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
            탈퇴하면 서버에 저장된 모든 기록과 게시글이 삭제돼요. 이 기기의 눈바디 사진은 따로 지워야 해요.
          </p>
          <Button variant="outline" className="mt-2 text-danger hover:bg-danger-soft hover:text-danger" onClick={() => setWithdraw(true)} disabled={isLive && !apiReady}>
            회원 탈퇴
          </Button>
          {isLive && !apiReady && <p className="text-[12px] text-text-subtle">준비 중 · 탈퇴는 서버(FastAPI) 연결 후 열려요. 사진 파일까지 함께 지워야 해서 앱에서 바로 처리하지 않아요.</p>}
        </Card>
      </div>
      <ConfirmDialog
        open={withdraw}
        onOpenChange={setWithdraw}
        title="정말 탈퇴할까요?"
        description="모든 기록이 삭제되고 되돌릴 수 없어요."
        confirmLabel="탈퇴"
        tone="danger"
        onConfirm={async () => {
          if (!isLive) {
            toast('목업: 탈퇴 처리 화면 (실제 삭제 없음)')
            return navigate('/login')
          }
          try {
            await api('/me', { method: 'DELETE' }) // 서버: 사진 파일 → 계정 삭제 (기록은 함께 삭제)
            await useAuthStore.getState().signOut()
            toast('탈퇴했어요. 그동안 고마웠어요.')
            navigate('/login', { replace: true })
          } catch (e) {
            toast.error('탈퇴하지 못했어요', { description: (e as Error).message || dbErrorMessage(e) })
          }
        }}
      />
    </>
  )
}
