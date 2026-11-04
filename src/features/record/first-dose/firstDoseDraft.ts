import type { InjectionSite, MedicationId } from '@/types/domain'

export interface FirstDoseDraft {
  medicationId: MedicationId | null
  doseMg: number | null
  site: InjectionSite | null
  date: Date | null
  time: string // HH:MM
  timeUnknown: boolean
  dateApproximate: boolean
  /** '전부터 투약 중': 회차별 날짜 (YYYY-MM-DD). 첫 날짜부터 7일 간격으로 자동, 사용자가 고치거나 뺄 수 있음 */
  seriesDates?: string[]
}

/** 하루 단위로 7일씩 — 첫 투약일부터 오늘까지 (최대 104회 = 2년) */
export const SERIES_INTERVAL_DAYS = 7
export const SERIES_MAX = 104
export function weeklyDates(first: Date, today = new Date()): string[] {
  const out: string[] = []
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const d = new Date(first.getFullYear(), first.getMonth(), first.getDate())
  while (d <= end && out.length < SERIES_MAX) {
    out.push(dateKey(d))
    d.setDate(d.getDate() + SERIES_INTERVAL_DAYS)
  }
  return out
}
const dateKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** 회차 날짜 문자열 + 초안의 시간 → Date 목록 (겹치는 날은 하나로, 오래된 순) */
export function seriesDateTimes(d: FirstDoseDraft): Date[] {
  const keys = [...new Set(d.seriesDates ?? [])].sort()
  return keys.flatMap((k) => {
    const [y, m, day] = k.split('-').map(Number)
    const at = combineDateTime({ ...d, date: new Date(y, m - 1, day) })
    return at ? [at] : []
  })
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
