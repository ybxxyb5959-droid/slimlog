import { Bell, Camera, ClipboardCheck, LogOut, ShieldUser, SlidersHorizontal, UserRound, UserX } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { toast } from 'sonner'

import { AppIcon } from '@/components/common/AppIcon'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { MockBadge } from '@/components/common/MockBadge'
import { PageHeader } from '@/components/common/PageHeader'
import { Card } from '@/components/ui/card'
import { MEDICATIONS } from '@/fixtures/medications.mock'
import { MOCK_PROFILE } from '@/fixtures/records.mock'
import { daysBetween } from '@/lib/date'

import { MyGroup, MyRow } from './MyRow'

export function MyPage() {
  const navigate = useNavigate()
  const [logout, setLogout] = useState(false)
  const p = MOCK_PROFILE
  const days = daysBetween(new Date(p.startedAt), new Date()) + 1

  return (
    <>
      <PageHeader title="마이" />
      <div className="space-y-6 md:max-w-2xl">
        <Link to="/my/profile" className="block">
          <Card className="flex items-center gap-4 hover:bg-surface-muted/40">
            <AppIcon icon={UserRound} size="lg" bg="soft" className="size-14 rounded-2xl" />
            <div className="min-w-0 flex-1">
              <p className="text-[18px] font-bold">{p.nickname}</p>
              <p className="tabular text-[13px] text-text-muted">
                {MEDICATIONS[p.medicationId].name} · 기록 {days}일째 · 목표 {p.goalWeightKg}kg
              </p>
            </div>
            <MockBadge />
          </Card>
        </Link>

        <MyGroup title="개인정보">
          <MyRow to="/my/consent" icon={ClipboardCheck} label="개인정보 · 민감정보 동의 관리" />
          <MyRow to="/my/eyebody-data" icon={Camera} label="눈바디 로컬 데이터" meta="이 기기에만 저장" />
        </MyGroup>

        <MyGroup title="설정">
          <MyRow to="/my/settings" icon={SlidersHorizontal} label="기록 설정" />
          <MyRow to="/my/settings#notifications" icon={Bell} label="알림 설정" />
        </MyGroup>

        <MyGroup title="계정">
          <MyRow to="/my/account" icon={UserX} label="계정 관리" meta="카카오 연결" />
          <button type="button" onClick={() => setLogout(true)} className="flex min-h-14 w-full items-center gap-3 px-5 py-3 text-left hover:bg-surface-muted/60">
            <AppIcon icon={LogOut} size="sm" tone="muted" />
            <span className="flex-1 text-[15px]">로그아웃</span>
          </button>
        </MyGroup>

        <MyGroup title="운영 (관리자 계정에만 보임 · 목업)">
          <MyRow to="/admin/moderation" icon={ShieldUser} label="관리자 검토" meta="대기 3건" />
        </MyGroup>
      </div>

      <ConfirmDialog
        open={logout}
        onOpenChange={setLogout}
        title="로그아웃할까요?"
        description="이 기기의 눈바디 사진은 지워지지 않아요."
        confirmLabel="로그아웃"
        onConfirm={() => {
          toast('목업: 로그아웃했어요')
          navigate('/login')
        }}
      />
    </>
  )
}
