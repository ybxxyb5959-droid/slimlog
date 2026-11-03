import { localInputToIso, toDateTimeLocalValue } from '@/lib/date'
import type { BodyInput } from '@/services/body'

/** 체중·체성분 입력 폼 — 체중만 필수, 체성분(골격근량·체지방량·체지방률)은 결과지가 있을 때만 */
export interface BodyDraft {
  measuredAt: string // datetime-local
  weightKg: string
  skeletalMuscleKg: string
  bodyFatKg: string
  bodyFatPct: string
}

export const emptyBodyDraft = (): BodyDraft => ({ measuredAt: toDateTimeLocalValue(new Date()), weightKg: '', skeletalMuscleKg: '', bodyFatKg: '', bodyFatPct: '' })

const toNum = (v: string) => (v.trim() === '' ? undefined : Number(v.replace(',', '.')))

export function draftToBody(d: BodyDraft): BodyInput {
  return {
    measuredAt: localInputToIso(d.measuredAt),
    weightKg: toNum(d.weightKg) as number,
    skeletalMuscleKg: toNum(d.skeletalMuscleKg),
    bodyFatKg: toNum(d.bodyFatKg),
    bodyFatPct: toNum(d.bodyFatPct),
  }
}

