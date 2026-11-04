import { isNativeApp } from './native'

/** 소셜 로그인에서 정상으로 돌아왔을 때 알리는 이벤트 */
export const AUTH_RETURN_EVENT = 'slimlog:auth-return'

/**
 * 갤럭시 앱(Capacitor) 시작 때 한 번 — 웹에서는 아무 일도 하지 않는다.
 * 1) 지문 저장소 연결 (src/lib/biometric.native.ts)
 * 2) 소셜 로그인 후 com.slimlog.app://auth-callback?code=… 로 돌아오면 세션으로 바꾸고 /auth/callback 화면으로
 */
export async function initNativeApp() {
  if (!isNativeApp()) return
  const [{ registerNativeBiometric }, { App }, { Browser }, { NATIVE_AUTH_CALLBACK }, { sb, isLive }] = await Promise.all([
    import('./biometric.native'),
    import('@capacitor/app'),
    import('@capacitor/browser'),
    import('@/services/live/auth'),
    import('./supabase'),
  ])
  registerNativeBiometric()

  await App.addListener('appUrlOpen', async ({ url }) => {
    if (!url.startsWith(NATIVE_AUTH_CALLBACK)) return
    window.dispatchEvent(new Event(AUTH_RETURN_EVENT)) // 로그인 화면의 '되돌아옴' 감지 타이머 취소
    await Browser.close().catch(() => {})
    const u = new URL(url.replace(/^com\.slimlog\.app:\/\//, 'https://app/'))
    const err = u.searchParams.get('error_description') ?? u.searchParams.get('error')
    const code = u.searchParams.get('code')
    if (!err && code && isLive) {
      const { error } = await sb().auth.exchangeCodeForSession(code)
      if (error) return void window.location.replace(`/auth/callback?error=${encodeURIComponent(error.message)}`)
    }
    window.location.replace(err ? `/auth/callback?error=${encodeURIComponent(err)}` : '/auth/callback')
  })
}
