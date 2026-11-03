import type { User } from '@supabase/supabase-js'

import { sb } from '@/lib/supabase'
import type { ConsentId } from '@/fixtures/consents'
import type { Dose, InjectionSite, MedicationId } from '@/types/domain'

/** 로그인한 사용자의 서버 상태 한 묶음 (users + user_health + 유효한 동의) */
export interface LiveAccount {
  userId: string
  email: string | null
  nickname: string | null
  role: 'user' | 'admin'
  onboardingStep: number
  onboardingCompletedAt: string | null
  legalName: string | null
  heightCm: number | null
  startWeightKg: number | null
  goalWeightKg: number | null
  consents: ConsentId[]
}

export const REQUIRED_CONSENTS: ConsentId[] = ['terms', 'privacy', 'sensitive']
export const hasRequiredConsents = (a: LiveAccount) => REQUIRED_CONSENTS.every((c) => a.consents.includes(c))

/** 로그인 후 어디로 보낼지 — 동의 → 온보딩 → 홈 */
export function nextPathFor(a: LiveAccount): string {
  if (!hasRequiredConsents(a)) return '/consent'
  if (!a.onboardingCompletedAt) return '/onboarding'
  return '/home'
}

/** 소셜 계정이 준 이름 (카카오 name·nickname, 구글 full_name/name) — 없으면 null */
export function socialNameOf(user: User): string | null {
  const m = user.user_metadata ?? {}
  const n = m.full_name ?? m.name ?? m.nickname ?? null
  return typeof n === 'string' && n.trim() ? n.trim().slice(0, 30) : null
}

export async function loadAccount(user: User): Promise<LiveAccount> {
  const db = sb()
  const [u, h, c] = await Promise.all([
    db.from('users').select('nickname, role, onboarding_step, onboarding_completed_at').eq('user_id', user.id).single(),
    db.from('user_health').select('legal_name, height_cm, start_weight_kg, goal_weight_kg').eq('user_id', user.id).single(),
    db.from('consents').select('type').eq('user_id', user.id).is('withdrawn_at', null),
  ])
  if (u.error) throw u.error
  if (h.error) throw h.error
  if (c.error) throw c.error

  // 첫 로그인: 소셜 계정 이름을 가입 이름으로 저장 (홈 인사말, 성 제외 표시)
  let legalName = h.data.legal_name
  if (!legalName) {
    const social = socialNameOf(user)
    if (social) {
      const r = await db.from('user_health').update({ legal_name: social }).eq('user_id', user.id)
      if (!r.error) legalName = social
    }
  }

  return {
    userId: user.id,
    email: user.email ?? null,
    nickname: u.data.nickname,
    role: u.data.role === 'admin' ? 'admin' : 'user',
    onboardingStep: u.data.onboarding_step,
    onboardingCompletedAt: u.data.onboarding_completed_at,
    legalName,
    heightCm: h.data.height_cm,
    startWeightKg: h.data.start_weight_kg,
    goalWeightKg: h.data.goal_weight_kg,
    consents: [...new Set(c.data.map((r) => r.type as ConsentId))],
  }
}

/** 가입 동의 저장 — 이미 유효한 동의는 다시 넣지 않는다 */
export async function saveConsents(userId: string, ids: ConsentId[], version = 'v1') {
  const db = sb()
  const cur = await db.from('consents').select('type').eq('user_id', userId).is('withdrawn_at', null)
  if (cur.error) throw cur.error
  const have = new Set(cur.data.map((r) => r.type))
  const rows = ids.filter((t) => !have.has(t)).map((type) => ({ user_id: userId, type, version }))
  if (rows.length) {
    const r = await db.from('consents').insert(rows)
    if (r.error) throw r.error
  }
}

// ── 투약 (doses) ──────────────────────────────────────────────

type DoseRow = {
  dose_id: string
  med_id: string
  dose_mg: number
  injected_at: string
  site: string | null
  memo: string | null
  time_unknown: boolean
  date_approx: boolean
}

export const rowToDose = (r: DoseRow): Dose => ({
  id: r.dose_id,
  medicationId: r.med_id as MedicationId,
  doseMg: Number(r.dose_mg),
  administeredAt: r.injected_at,
  site: (r.site ?? 'abdomen_left') as InjectionSite,
  memo: r.memo ?? undefined,
  timeUnknown: r.time_unknown || undefined,
  dateApproximate: r.date_approx || undefined,
})

const doseToRow = (d: Omit<Dose, 'id'>) => ({
  med_id: d.medicationId,
  dose_mg: d.doseMg,
  injected_at: d.administeredAt,
  site: d.site,
  memo: d.memo ?? null,
  time_unknown: !!d.timeUnknown,
  date_approx: !!d.dateApproximate,
})

const DOSE_COLS = 'dose_id, med_id, dose_mg, injected_at, site, memo, time_unknown, date_approx'

export async function fetchDoses(): Promise<Dose[]> {
  const r = await sb().from('doses').select(DOSE_COLS).order('injected_at', { ascending: false })
  if (r.error) throw r.error
  return r.data.map(rowToDose)
}

export async function insertDose(d: Omit<Dose, 'id'>): Promise<Dose> {
  const r = await sb().from('doses').insert(doseToRow(d)).select(DOSE_COLS).single()
  if (r.error) throw r.error
  return rowToDose(r.data)
}

export async function updateDoseRow(d: Dose): Promise<Dose> {
  const r = await sb().from('doses').update(doseToRow(d)).eq('dose_id', d.id).select(DOSE_COLS).single()
  if (r.error) throw r.error
  return rowToDose(r.data)
}

export async function deleteDoseRow(id: string) {
  const r = await sb().from('doses').delete().eq('dose_id', id)
  if (r.error) throw r.error
}
