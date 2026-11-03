const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

export const DAY_MS = 24 * 60 * 60 * 1000

export function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * DAY_MS)
}

/** 2026.11.03 (화) */
export function formatFullDate(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}.${m}.${d} (${WEEKDAYS[date.getDay()]})`
}

/** 11/3 */
export function formatShortDate(date: Date) {
  return `${date.getMonth() + 1}/${date.getDate()}`
}

/** 11/3(화) */
export function formatShortDateWithDay(date: Date) {
  return `${formatShortDate(date)}(${WEEKDAYS[date.getDay()]})`
}

/** 21:00 */
export function formatTime(date: Date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

/** <input type="datetime-local"> 값 */
export function toDateTimeLocalValue(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function startOfDay(date: Date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

export function daysBetween(a: Date, b: Date) {
  return Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / DAY_MS)
}

export function greetingFor(date: Date) {
  const h = date.getHours()
  if (h < 11) return '좋은 아침이에요'
  if (h < 17) return '오늘도 기록해볼까요'
  return '오늘 하루 수고했어요'
}

/** 로컬 날짜 키 'YYYY-MM-DD' (daily_checks.date 와 같은 형식) */
export function toDateKey(date: Date) {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`
}

/** datetime-local 값 → ISO. 초가 없어서 '지금(같은 분)'을 고르면 정확한 현재 시각을 쓴다 — 방금 저장한 기록이 가장 최신으로 정렬되게 */
export function localInputToIso(v: string) {
  if (!v) return ''
  return v === toDateTimeLocalValue(new Date()) ? new Date().toISOString() : new Date(v).toISOString()
}
