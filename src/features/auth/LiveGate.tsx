import type * as React from 'react'
import { Navigate, useLocation } from 'react-router'

import { ErrorState, LoadingState } from '@/components/common/StateViews'
import { Button } from '@/components/ui/button'
import { isLive } from '@/lib/supabase'
import { hasRequiredConsents } from '@/services/live/account'
import { useAuthStore } from '@/stores/authStore'

/**
 * 실서비스(live) 모드의 화면 출입 관리. 목업 모드에서는 그대로 통과한다.
 * - session: 로그인만 되어 있으면 됨 (가입 동의 화면)
 * - consented: 필수 동의까지 (온보딩)
 * - ready: 온보딩까지 끝남 (앱 본 화면)
 */
export function LiveGate({ need, children }: { need: 'session' | 'consented' | 'ready'; children: React.ReactNode }) {
  const { status, account, error, refreshAccount, signOut } = useAuthStore()
  const location = useLocation()
  if (!isLive) return <>{children}</>

  if (status === 'loading') return <LoadingState title="불러오는 중" className="min-h-dvh" />
  if (status === 'error')
    return (
      <ErrorState
        className="min-h-dvh"
        title="계정 정보를 불러오지 못했어요"
        description={error ?? undefined}
        action={
          <div className="flex gap-2">
            <Button onClick={() => refreshAccount()}>다시 시도</Button>
            <Button variant="outline" onClick={() => signOut()}>
              로그아웃
            </Button>
          </div>
        }
      />
    )
  if (status === 'signedOut' || !account) return <Navigate to="/login" replace state={{ from: location.pathname }} />

  if (need !== 'session' && !hasRequiredConsents(account)) return <Navigate to="/consent" replace />
  if (need === 'ready' && !account.onboardingCompletedAt) return <Navigate to="/onboarding" replace />
  return <>{children}</>
}
