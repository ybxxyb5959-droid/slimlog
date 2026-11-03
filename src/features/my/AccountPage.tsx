import { useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { PageHeader } from '@/components/common/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ProviderMark } from '@/features/auth/ProviderMark'

export function AccountPage() {
  const navigate = useNavigate()
  const [withdraw, setWithdraw] = useState(false)
  return (
    <>
      <PageHeader title="연결된 로그인 계정" back="/my/settings" />
      <div className="space-y-4 md:max-w-2xl">
        <Card className="space-y-3">
          <h2 className="text-[15px] font-semibold">로그인 계정</h2>
          <div className="flex items-center gap-3">
            <ProviderMark provider="kakao" className="size-9" />
            <div className="flex-1">
              <p className="text-[15px]">카카오</p>
              <p className="text-[13px] text-text-muted">jiwon@example.com (예시)</p>
            </div>
            <Badge tone="success">연결됨</Badge>
          </div>
        </Card>
        <Card className="space-y-2">
          <h2 className="text-[15px] font-semibold text-danger">회원 탈퇴</h2>
          <p className="text-[13px] leading-relaxed text-text-muted">
            탈퇴하면 서버에 저장된 모든 기록과 게시글이 삭제돼요. 이 기기의 눈바디 사진은 따로 지워야 해요.
          </p>
          <Button variant="outline" className="mt-2 text-danger hover:bg-danger-soft hover:text-danger" onClick={() => setWithdraw(true)}>
            회원 탈퇴
          </Button>
        </Card>
      </div>
      <ConfirmDialog
        open={withdraw}
        onOpenChange={setWithdraw}
        title="정말 탈퇴할까요?"
        description="모든 기록이 삭제되고 되돌릴 수 없어요."
        confirmLabel="탈퇴"
        tone="danger"
        onConfirm={() => {
          toast('목업: 탈퇴 처리 화면 (실제 삭제 없음)')
          navigate('/login')
        }}
      />
    </>
  )
}
