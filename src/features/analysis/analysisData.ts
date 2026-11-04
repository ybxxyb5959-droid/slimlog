import { toDateKey } from '@/lib/date'
import { sumNutrients } from '@/lib/nutrition'
import type { DailyCondition } from '@/services/live/records'
import type { BodyEntry } from '@/stores/recordsStore'
import type { WaterLog } from '@/stores/intakeStore'
import type { Dose, Symptom } from '@/types/domain'
import type { MealRecord } from '@/types/meal'

/**
 * 분석 화면 공통 계산 — 저장된 기록만으로 만든다 (없으면 빈 값, 추정·보간으로 채우지 않음).
 * 증상과 투약을 같은 날짜에 나란히 보여줄 뿐, 둘의 관계를 판단하지 않는다.
 */
export interface DayRow {
  date: string // YYYY-MM-DD
  doses: Dose[]
  weightKg: number | null
  kcal: number | null
  proteinG: number | null
  carbG: number | null
  fatG: number | null
  nutritionIncomplete: boolean
  meals: number
  symptoms: Symptom[]
  condition: number | null
  waterMl: number
}

export interface Sources {
  doses: Dose[]
  bodyLogs: BodyEntry[]
  meals: MealRecord[]
  symptoms: Symptom[]
  daily: DailyCondition[]
  water: WaterLog[]
}

const key = (iso: string) => toDateKey(new Date(iso))

export function buildDays(src: Sources, days: number, now = new Date()): DayRow[] {
  const rows: DayRow[] = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const k = toDateKey(d)
    const meals = src.meals.filter((m) => key(m.eatenAt) === k)
    const n = meals.length ? sumNutrients(meals.flatMap((m) => m.items)) : null
    const weights = src.bodyLogs.filter((b) => key(b.measuredAt) === k).sort((a, b) => a.measuredAt.localeCompare(b.measuredAt))
    rows.push({
      date: k,
      doses: src.doses.filter((x) => key(x.administeredAt) === k),
      weightKg: weights.at(-1)?.weightKg ?? null,
      kcal: n ? n.kcal : null,
      proteinG: n ? n.proteinG : null,
      carbG: n ? n.carbG : null,
      fatG: n ? n.fatG : null,
      nutritionIncomplete: !!n?.incomplete,
      meals: meals.length,
      symptoms: src.symptoms.filter((s) => key(s.recordedAt) === k),
      condition: src.daily.find((x) => x.date === k)?.condition ?? null,
      waterMl: src.water.filter((w) => key(w.at) === k).reduce((a, w) => a + w.ml, 0),
    })
  }
  return rows
}

export const hasAny = (r: DayRow) => r.doses.length > 0 || r.weightKg !== null || r.meals > 0 || r.symptoms.length > 0 || r.condition !== null || r.waterMl > 0

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)

/** 상담 준비 요약 — 기간 내 기록 집계 (판단·권고 없음) */
export function summarize(rows: DayRow[], src: Sources) {
  const from = rows[0]?.date
  const inRange = (iso: string) => key(iso) >= from
  const weights = src.bodyLogs.filter((b) => inRange(b.measuredAt)).sort((a, b) => a.measuredAt.localeCompare(b.measuredAt))
  const symptomCounts = new Map<string, { count: number; maxSeverity: number }>()
  for (const s of src.symptoms.filter((x) => inRange(x.recordedAt))) {
    const c = symptomCounts.get(s.type) ?? { count: 0, maxSeverity: 0 }
    symptomCounts.set(s.type, { count: c.count + 1, maxSeverity: Math.max(c.maxSeverity, s.severity) })
  }
  const kcalDays = rows.filter((r) => r.kcal !== null)
  return {
    from,
    to: rows.at(-1)?.date,
    doses: src.doses.filter((d) => inRange(d.administeredAt)).sort((a, b) => a.administeredAt.localeCompare(b.administeredAt)),
    weightFirst: weights[0] ?? null,
    weightLast: weights.at(-1) ?? null,
    weightCount: weights.length,
    symptoms: [...symptomCounts.entries()].map(([type, v]) => ({ type, ...v })).sort((a, b) => b.count - a.count),
    avgCondition: avg(rows.map((r) => r.condition).filter((x): x is number => x !== null)),
    conditionDays: rows.filter((r) => r.condition !== null).length,
    avgKcal: avg(kcalDays.map((r) => r.kcal!)),
    kcalDays: kcalDays.length,
    recordedDays: rows.filter(hasAny).length,
  }
}
