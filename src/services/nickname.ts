import { generateNickname } from '@/lib/nickname'

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
  await wait(450, signal)
  if (name === '네트워크오류') throw new Error('network') // 목업: 오류 상태 시연
  return TAKEN.has(name) ? 'duplicate' : 'available'
}

export type ReserveResult = { ok: true } | { ok: false; code: 'NICKNAME_TAKEN'; suggestions: string[] }

/** 저장(확정) — UNIQUE 제약 위반을 흉내 낸다 */
export async function reserveNickname(name: string): Promise<ReserveResult> {
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
