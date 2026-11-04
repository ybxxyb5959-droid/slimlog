import { isNativeApp } from '@/lib/native'
import { sb } from '@/lib/supabase'
import type { ProviderId } from '@/features/auth/providers'

/** Supabase 프로젝트에서 켜져 있는 소셜 로그인 (GET /auth/v1/settings — anon 키로 공개 조회) */
export async function enabledProviders(): Promise<Partial<Record<ProviderId, boolean>>> {
  const url = import.meta.env.VITE_SUPABASE_URL
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY
  const res = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: key! } })
  if (!res.ok) throw new Error(`settings ${res.status}`)
  const json = (await res.json()) as { external?: Record<string, boolean> }
  const ext = json.external ?? {}
  return { kakao: !!ext.kakao, google: !!ext.google, apple: !!ext.apple, naver: false }
}

/** 갤럭시 앱 로그인 후 돌아오는 주소 (AndroidManifest intent-filter, Supabase Redirect URLs 에 등록 필요) */
export const NATIVE_AUTH_CALLBACK = 'com.slimlog.app://auth-callback'

/**
 * 소셜 로그인 시작
 * - 웹: 브라우저가 카카오/구글 로그인 화면으로 이동했다가 /auth/callback 으로 돌아온다
 * - 갤럭시 앱: 구글은 앱 안 웹뷰 로그인을 막으므로 시스템 브라우저(Custom Tabs)로 열고,
 *   로그인이 끝나면 com.slimlog.app://auth-callback?code=… 로 앱이 다시 열린다 (src/lib/nativeApp.ts 에서 처리)
 */
export async function startOAuth(provider: 'kakao' | 'google' | 'apple') {
  if (isNativeApp()) {
    const { data, error } = await sb().auth.signInWithOAuth({ provider, options: { redirectTo: NATIVE_AUTH_CALLBACK, skipBrowserRedirect: true } })
    if (error) throw error
    const { Browser } = await import('@capacitor/browser')
    await Browser.open({ url: data.url })
    return
  }
  const { error } = await sb().auth.signInWithOAuth({
    provider,
    options: { redirectTo: `${window.location.origin}/auth/callback` },
  })
  if (error) throw error
}

/** 개발용 이메일 로그인 — 없으면 가입 (로컬 Supabase 는 이메일 확인 없이 바로 세션 발급) */
export async function devEmailLogin(email: string, password: string) {
  const db = sb()
  const signIn = await db.auth.signInWithPassword({ email, password })
  if (!signIn.error) return
  if (!/invalid login credentials/i.test(signIn.error.message)) throw signIn.error
  const signUp = await db.auth.signUp({ email, password, options: { data: { full_name: '김테스트' } } })
  if (signUp.error) throw signUp.error
  if (!signUp.data.session) throw new Error('이메일 확인이 켜져 있어 바로 로그인할 수 없어요 (로컬 Supabase 설정 확인)')
}
