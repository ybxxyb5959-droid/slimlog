import { Bell, FileText, Headset, KeyRound, Link2, LogOut, MonitorSmartphone, ShieldUser, Database, type LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'

import { AppIcon } from '@/components/common/AppIcon'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { PageHeader } from '@/components/common/PageHeader'
import { isLive } from '@/lib/supabase'
import { resetToDemoUser } from '@/services/session'
import { useAuthStore } from '@/stores/authStore'

import { MyGroup, MyRow } from './MyRow'

const GROUPS: { title: string; rows: { to: string; icon: LucideIcon; label: string; meta?: string }[] }[] = [
  {
    title: '앱 설정',
    rows: [
      { to: '/my/settings/notifications', icon: Bell, label: '알림 설정' },
      { to: '/my/settings/app', icon: MonitorSmartphone, label: '화면 및 앱 환경' },
    ],
  },
  {
    title: '개인정보 및 계정',
    rows: [
      { to: '/my/consent', icon: KeyRound, label: '개인정보 · 보안' },
      { to: '/my/account', icon: Link2, label: '연결된 로그인 계정' },
      { to: '/my/data', icon: Database, label: '내 데이터 관리' },
    ],
  },
  {
    title: '서비스',
    rows: [
      { to: '/my/support', icon: Headset, label: '고객지원 · 서비스 정보' },
      { to: '/my/terms', icon: FileText, label: '이용약관 · 개인정보 처리방침' },
    ],
  },
  {
    title: '운영',
    rows: [{ to: '/admin/moderation', icon: ShieldUser, label: '관리자 검토' }],
  },
]

/** 설정 — 마이페이지 하위 화면. 뒤로 가기는 마이페이지로 */
export function SettingsHubPage() {
  const navigate = useNavigate()
  const [logout, setLogout] = useState(false)
  // 운영 메뉴는 관리자 계정에만 (목업은 화면 확인용으로 보여 줌)
  const isAdmin = useAuthStore((s) => (isLive ? s.account?.role === 'admin' : true))
  return (
    <>
      <PageHeader title="설정" back="/my" />
      <div className="space-y-6 md:max-w-2xl">
        {GROUPS.filter((g) => g.title !== '운영' || isAdmin).map((g) => (
          <MyGroup key={g.title} title={g.title}>
            {g.rows.map((r) => (
              <MyRow key={r.to} {...r} />
            ))}
          </MyGroup>
        ))}
        {!isLive && (
        <button
          type="button"
          onClick={() => {
            resetToDemoUser()
            toast('목업: 예시 사용자(6주치 기록)로 되돌렸어요')
            navigate('/home')
          }}
          className="flex min-h-12 w-full items-center justify-center rounded-card border border-dashed border-border text-[14px] text-text-muted hover:bg-surface-muted"
        >
          목업: 예시 사용자 데이터로 되돌리기
        </button>
        )}
        <button
          type="button"
          onClick={() => setLogout(true)}
          className="flex min-h-14 w-full items-center justify-center gap-2 rounded-card border border-border bg-surface text-[15px] font-medium text-text-muted hover:bg-surface-muted"
        >
          <AppIcon icon={LogOut} size="sm" tone="muted" /> 로그아웃
        </button>
        <p className="text-center text-[12px] text-text-subtle">회원 탈퇴는 ‘연결된 로그인 계정’에서 할 수 있어요.</p>
      </div>
      <ConfirmDialog
        open={logout}
        onOpenChange={setLogout}
        title="로그아웃할까요?"
        description="이 기기의 눈바디 사진은 지워지지 않아요."
        confirmLabel="로그아웃"
        onConfirm={async () => {
          if (isLive) await useAuthStore.getState().signOut()
          else toast('목업: 로그아웃했어요')
          navigate('/login', { replace: true })
        }}
      />
    </>
  )
}
