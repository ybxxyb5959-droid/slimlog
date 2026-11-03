import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router'

import { ErrorState, LoadingState } from '@/components/common/StateViews'
import { Button } from '@/components/ui/button'
import { nextPathFor } from '@/services/live/account'
import { useAuthStore } from '@/stores/authStore'

/**
 * 소셜 로그인 후 돌아오는 주소 (/auth/callback?code=…)
 * Supabase 클라이언트가 주소의 code 를 세션으로 바꾸면(detectSessionInUrl) 로그인 상태가 된다.
 */
export function AuthCallbackPage() {
  const { status, account } = useAuthStore()
  const params = new URLSearchParams(window.location.search)
  const providerError = params.get('error_description') ?? params.get('error')
  const [timedOut, setTimedOut] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setTimedOut(true), 15000)
    return () => clearTimeout(t)
  }, [])

  if (status === 'signedIn' && account) return <Navigate to={nextPathFor(account)} replace />
  if (providerError || (timedOut && status !== 'loading') || status === 'error')
    return (
      <ErrorState
        className="min-h-dvh"
        title="로그인하지 못했어요"
        description={providerError ?? '다시 시도해 주세요.'}
        action={
          <Button asChild>
            <Link to="/login">로그인 화면으로</Link>
          </Button>
        }
      />
    )
  return <LoadingState className="min-h-dvh" title="로그인 확인 중" />
}
