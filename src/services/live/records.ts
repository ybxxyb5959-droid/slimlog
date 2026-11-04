import { sb } from '@/lib/supabase'
import type { BodyLog, BodyLogSource, Symptom, SymptomType } from '@/types/domain'

/** 체중·체성분(body_logs), 증상(symptoms), 하루 컨디션(daily_checks) — Supabase 접근 (RLS: 본인 + 민감정보 동의) */

const BODY_COLS = 'log_id, measured_at, weight_kg, skeletal_muscle_kg, body_fat_kg, body_fat_pct, source, is_verified, is_baseline'
type BodyRow = {
  log_id: string
  measured_at: string
  weight_kg: number
  skeletal_muscle_kg: number | null
  body_fat_kg: number | null
  body_fat_pct: number | null
  source: string
  is_verified: boolean
  is_baseline: boolean
}
const num = (v: number | null) => (v === null ? undefined : Number(v))
export const rowToBody = (r: BodyRow): BodyLog & { isBaseline: boolean } => ({
  id: r.log_id,
  measuredAt: r.measured_at,
  weightKg: Number(r.weight_kg),
  skeletalMuscleKg: num(r.skeletal_muscle_kg),
  bodyFatKg: num(r.body_fat_kg),
  bodyFatPct: num(r.body_fat_pct),
  source: r.source as BodyLogSource,
  isVerified: r.is_verified,
  isBaseline: r.is_baseline,
})

export type BodyInput = Pick<BodyLog, 'measuredAt' | 'weightKg' | 'skeletalMuscleKg' | 'bodyFatKg' | 'bodyFatPct'>
const bodyToRow = (b: BodyInput) => ({
  measured_at: b.measuredAt,
  weight_kg: b.weightKg,
  skeletal_muscle_kg: b.skeletalMuscleKg ?? null,
  body_fat_kg: b.bodyFatKg ?? null,
  body_fat_pct: b.bodyFatPct ?? null,
})

export async function fetchBodyLogs() {
  const r = await sb().from('body_logs').select(BODY_COLS).order('measured_at', { ascending: true })
  if (r.error) throw r.error
  return r.data.map(rowToBody)
}
export async function insertBodyLog(b: BodyInput) {
  const r = await sb().from('body_logs').insert({ ...bodyToRow(b), source: 'MANUAL' }).select(BODY_COLS).single()
  if (r.error) throw r.error
  return rowToBody(r.data)
}
export async function updateBodyLog(id: string, b: BodyInput) {
  const r = await sb().from('body_logs').update(bodyToRow(b)).eq('log_id', id).select(BODY_COLS).single()
  if (r.error) throw r.error
  return rowToBody(r.data)
}
export async function deleteBodyLog(id: string) {
  const r = await sb().from('body_logs').delete().eq('log_id', id)
  if (r.error) throw r.error
}

// ── 증상 ─────────────────────────────────────────────────────
const SYM_COLS = 'symptom_id, type, severity, started_at, duration_h, memo'
type SymRow = { symptom_id: string; type: string; severity: number; started_at: string; duration_h: number | null; memo: string | null }
const rowToSymptom = (r: SymRow): Symptom => ({
  id: r.symptom_id,
  type: r.type as SymptomType,
  severity: r.severity,
  recordedAt: r.started_at,
  durationH: r.duration_h === null ? null : Number(r.duration_h),
  memo: r.memo,
})
export type SymptomInput = Omit<Symptom, 'id'>
const symToRow = (s: SymptomInput) => ({ type: s.type, severity: s.severity, started_at: s.recordedAt, duration_h: s.durationH ?? null, memo: s.memo?.trim() || null })

export async function fetchSymptoms() {
  const r = await sb().from('symptoms').select(SYM_COLS).order('started_at', { ascending: false })
  if (r.error) throw r.error
  return r.data.map(rowToSymptom)
}
export async function insertSymptom(s: SymptomInput) {
  const r = await sb().from('symptoms').insert(symToRow(s)).select(SYM_COLS).single()
  if (r.error) throw r.error
  return rowToSymptom(r.data)
}
export async function updateSymptom(id: string, s: SymptomInput) {
  const r = await sb().from('symptoms').update(symToRow(s)).eq('symptom_id', id).select(SYM_COLS).single()
  if (r.error) throw r.error
  return rowToSymptom(r.data)
}
export async function deleteSymptom(id: string) {
  const r = await sb().from('symptoms').delete().eq('symptom_id', id)
  if (r.error) throw r.error
}

// ── 하루 컨디션 (daily_checks: 날짜당 1행) ─────────────────────
export interface DailyCondition {
  date: string // YYYY-MM-DD
  sleepH: number | null
  appetite: number | null
  condition: number | null
}
export async function fetchDailyChecks(): Promise<DailyCondition[]> {
  const r = await sb().from('daily_checks').select('date, sleep_h, appetite, condition').order('date', { ascending: false }).limit(120)
  if (r.error) throw r.error
  return r.data.map((d) => ({ date: d.date, sleepH: d.sleep_h === null ? null : Number(d.sleep_h), appetite: d.appetite, condition: d.condition }))
}
/** 같은 날짜가 있으면 고치고 없으면 만든다 (user_id, date UNIQUE) */
export async function upsertDailyCheck(userId: string, c: DailyCondition) {
  const r = await sb()
    .from('daily_checks')
    .upsert({ user_id: userId, date: c.date, sleep_h: c.sleepH, appetite: c.appetite, condition: c.condition }, { onConflict: 'user_id,date' })
  if (r.error) throw r.error
}

// ── 케어: 물·영양제·복용약 (intake_items, intake_logs) ─────────────────────
export async function fetchIntake() {
  const db = sb()
  const since = new Date()
  since.setDate(since.getDate() - 30)
  const [items, logs] = await Promise.all([
    db.from('intake_items').select('item_id, kind, name, active, remind_enabled, remind_hour, remind_asked').eq('active', true).order('created_at'),
    db.from('intake_logs').select('log_id, kind, item_id, amount_ml, taken_at, status').gte('taken_at', since.toISOString()).order('taken_at'),
  ])
  if (items.error) throw items.error
  if (logs.error) throw logs.error
  return { items: items.data, logs: logs.data }
}
export async function insertIntakeItem(kind: 'supplement' | 'medicine', name: string) {
  const r = await sb().from('intake_items').insert({ kind, name }).select('item_id').single()
  if (r.error) throw r.error
  return r.data.item_id
}
export async function deleteIntakeItem(itemId: string) {
  const db = sb()
  const l = await db.from('intake_logs').delete().eq('item_id', itemId)
  if (l.error) throw l.error
  const r = await db.from('intake_items').delete().eq('item_id', itemId)
  if (r.error) throw r.error
}
export async function insertIntakeLog(row: { kind: 'water' | 'supplement' | 'medicine'; item_id?: string | null; amount_ml?: number | null; taken_at: string; status?: 'taken' | 'skipped' }) {
  const r = await sb().from('intake_logs').insert(row).select('log_id').single()
  if (r.error) throw r.error
  return r.data.log_id
}
export async function deleteIntakeLog(logId: string) {
  const r = await sb().from('intake_logs').delete().eq('log_id', logId)
  if (r.error) throw r.error
}

/** 알림 설정 (매일 몇 시) */
export async function updateIntakeReminder(itemId: string, patch: { remind_enabled?: boolean; remind_hour?: number | null; remind_asked?: boolean }) {
  const r = await sb().from('intake_items').update(patch).eq('item_id', itemId)
  if (r.error) throw r.error
}
