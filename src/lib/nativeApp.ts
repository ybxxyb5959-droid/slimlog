import { isNativeApp } from './native'

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
