import type { InjectionSite, MedicationId } from '@/types/domain'

export interface FirstDoseDraft {
  medicationId: MedicationId | null
  doseMg: number | null
  site: InjectionSite | null
  date: Date | null
  time: string // HH:MM
  timeUnknown: boolean
  dateApproximate: boolean
}

export const EMPTY_DRAFT: FirstDoseDraft = {
  medicationId: null,
  doseMg: null,
  site: null,
  date: null,
  time: '',
  timeUnknown: false,
  dateApproximate: false,
}

export const isDirty = (d: FirstDoseDraft) =>
  d.medicationId !== null || d.doseMg !== null || d.site !== null || d.date !== null

/** 날짜+시간 → Date. 시간 모름이면 12:00으로 둔다 */
export function combineDateTime(d: FirstDoseDraft): Date | null {
  if (!d.date) return null
  const out = new Date(d.date)
  const [h, m] = (d.timeUnknown ? '12:00' : d.time || '').split(':').map(Number)
  if (Number.isNaN(h) || Number.isNaN(m)) return null
  out.setHours(h, m, 0, 0)
  return out
}

/** 미래 투약 기록 금지 — 시간 모름이면 날짜만 검사 */
export function dateTimeError(d: FirstDoseDraft): string | null {
  if (!d.date) return '날짜를 선택해 주세요.'
  const today = new Date()
  today.setHours(23, 59, 59, 999)
  if (d.date > today) return '미래 날짜는 기록할 수 없어요.'
  if (d.timeUnknown) return null
  if (!d.time) return '시간을 입력하거나 ‘시간이 기억나지 않아요’를 선택해 주세요.'
  const at = combineDateTime(d)
  if (at && at.getTime() > Date.now() + 60_000) return '아직 지나지 않은 시간이에요. 투약한 시간을 입력해 주세요.'
  return null
}
