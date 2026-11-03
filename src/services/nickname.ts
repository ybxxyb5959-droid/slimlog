import { generateNickname } from '@/lib/nickname'
import { isLive, sb } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

/**
 * 닉네임 중복 확인·확정 — 목업.
 * 실제: GET /nicknames/{name}/availability + 저장 시 DB UNIQUE 제약 (PROFILES.nickname)
 * 확인과 저장 사이에 다른 사람이 먼저 쓰면 저장 단계에서 409 → 다른 닉네임 안내.
 */
const TAKEN = new Set(['느긋한판다', '용감한고래', '차분한수달', '산뜻한레몬'])
/** 목업 시연용: 확인은 통과하지만 저장 순간 다른 사람이 먼저 가져간 경우 */
const TAKEN_DURING_SAVE = new Set(['졸린복숭아'])

const wait = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => {
      clearTimeout(t)
      reject(new DOMException('aborted', 'AbortError'))
    })
  })

export type Availability = 'available' | 'duplicate'

export async function checkNicknameAvailability(name: string, signal?: AbortSignal): Promise<Availability> {
  if (isLive) {
    const r = await sb().rpc('nickname_available', { name }).abortSignal(signal ?? new AbortController().signal)
    if (r.error) throw r.error
    return r.data ? 'available' : 'duplicate'
  }
  await wait(450, signal)
  if (name === '네트워크오류') throw new Error('network') // 목업: 오류 상태 시연
  return TAKEN.has(name) ? 'duplicate' : 'available'
}

export type ReserveResult = { ok: true } | { ok: false; code: 'NICKNAME_TAKEN'; suggestions: string[] }

/** 저장(확정) — UNIQUE 제약 위반을 흉내 낸다 */
export async function reserveNickname(name: string): Promise<ReserveResult> {
  if (isLive) return reserveNicknameLive(name)
  await wait(500)
  if (TAKEN.has(name) || TAKEN_DURING_SAVE.has(name)) {
    TAKEN.add(name)
    const used = new Set([...TAKEN, name])
    const suggestions: string[] = []
    while (suggestions.length < 3) {
      const n = generateNickname([...used, ...suggestions])
      suggestions.push(n)
    }
    return { ok: false, code: 'NICKNAME_TAKEN', suggestions }
  }
  TAKEN.add(name)
  return { ok: true }
}

export function suggestNickname(exclude: string[] = []) {
  return generateNickname([...TAKEN, ...TAKEN_DURING_SAVE, ...exclude])
}

/** 실서비스: users.nickname 저장. 확인 뒤 다른 사람이 먼저 쓰면 UNIQUE 위반(23505) → 다른 후보 3개 제안 */
async function reserveNicknameLive(name: string): Promise<ReserveResult> {
  const account = useAuthStore.getState().account
  if (!account) throw new Error('로그인이 필요해요')
  const db = sb()
  const r = await db
    .from('users')
    .update({ nickname: name, onboarding_step: Math.max(account.onboardingStep, 1) })
    .eq('user_id', account.userId)
  if (r.error?.code === '23505') {
    const suggestions: string[] = []
    const tried = new Set([name])
    while (suggestions.length < 3 && tried.size < 30) {
      const n = generateNickname([...tried])
      tried.add(n)
      const ok = await db.rpc('nickname_available', { name: n })
      if (ok.data) suggestions.push(n)
    }
    return { ok: false, code: 'NICKNAME_TAKEN', suggestions }
  }
  if (r.error) throw r.error
  useAuthStore.setState({ account: { ...account, nickname: name, onboardingStep: Math.max(account.onboardingStep, 1) } })
  return { ok: true }
}
