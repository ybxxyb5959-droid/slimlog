import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useRef, useState } from 'react'

import { addDays, startOfDay } from '@/lib/date'
import { cn } from '@/lib/utils'

import { AppIcon } from './AppIcon'

const WEEK = ['일', '월', '화', '수', '목', '금', '토']
const sameDay = (a: Date, b: Date) => startOfDay(a).getTime() === startOfDay(b).getTime()

/**
 * 월 달력 — 단일 날짜 선택
 * 키보드: ←→ 하루, ↑↓ 일주일, Enter/Space 선택. maxDate 이후는 선택 불가.
 */
export function Calendar({
  value,
  onChange,
  maxDate,
}: {
  value: Date | null
  onChange: (d: Date) => void
  maxDate?: Date
}) {
  const today = startOfDay(new Date())
  const [month, setMonth] = useState(() => {
    const base = value ?? today
    return new Date(base.getFullYear(), base.getMonth(), 1)
  })
  const [focus, setFocus] = useState<Date>(value ?? today)
  const gridRef = useRef<HTMLDivElement>(null)

  const first = new Date(month.getFullYear(), month.getMonth(), 1)
  const days = Array.from({ length: 42 }, (_, i) => addDays(first, i - first.getDay()))
  const lastRowNeeded = days.slice(35).some((d) => d.getMonth() === month.getMonth())
  const cells = lastRowNeeded ? days : days.slice(0, 35)
  const isDisabled = (d: Date) => !!maxDate && startOfDay(d) > startOfDay(maxDate)
  const nextMonthDisabled = !!maxDate && new Date(month.getFullYear(), month.getMonth() + 1, 1) > maxDate

  const moveFocus = (d: Date) => {
    setFocus(d)
    if (d.getMonth() !== month.getMonth() || d.getFullYear() !== month.getFullYear())
      setMonth(new Date(d.getFullYear(), d.getMonth(), 1))
    requestAnimationFrame(() =>
      gridRef.current?.querySelector<HTMLButtonElement>(`[data-day="${startOfDay(d).getTime()}"]`)?.focus(),
    )
  }

  return (
    <div className="rounded-2xl border border-border p-3">
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          className="inline-flex size-10 items-center justify-center rounded-full hover:bg-surface-muted"
          onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
          aria-label="이전 달"
        >
          <AppIcon icon={ChevronLeft} size="sm" tone="text" />
        </button>
        <p className="tabular text-[15px] font-semibold" aria-live="polite">
          {month.getFullYear()}년 {month.getMonth() + 1}월
        </p>
        <button
          type="button"
          className="inline-flex size-10 items-center justify-center rounded-full hover:bg-surface-muted disabled:opacity-30"
          onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
          disabled={nextMonthDisabled}
          aria-label="다음 달"
        >
          <AppIcon icon={ChevronRight} size="sm" tone="text" />
        </button>
      </div>
      <div className="grid grid-cols-7 text-center text-[12px] text-text-subtle" aria-hidden>
        {WEEK.map((w) => (
          <span key={w} className="py-1">
            {w}
          </span>
        ))}
      </div>
      <div ref={gridRef} role="grid" aria-label="날짜 선택" className="grid grid-cols-7 gap-y-1">
        {cells.map((d) => {
          const outside = d.getMonth() !== month.getMonth()
          const disabled = isDisabled(d)
          const selected = !!value && sameDay(d, value)
          const isToday = sameDay(d, today)
          const focused = sameDay(d, focus)
          return (
            <div key={d.getTime()} role="gridcell" className="flex justify-center">
              <button
                type="button"
                data-day={startOfDay(d).getTime()}
                tabIndex={focused ? 0 : -1}
                disabled={disabled}
                aria-selected={selected}
                aria-current={isToday ? 'date' : undefined}
                aria-label={`${d.getMonth() + 1}월 ${d.getDate()}일${isToday ? ' 오늘' : ''}${disabled ? ' (선택할 수 없음)' : ''}`}
                onClick={() => {
                  setFocus(d)
                  onChange(d)
                }}
                onKeyDown={(e) => {
                  const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key]
                  if (step) {
                    e.preventDefault()
                    moveFocus(addDays(d, step))
                  }
                }}
                className={cn(
                  'tabular relative inline-flex size-10 items-center justify-center rounded-full text-[14px] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
                  outside && 'text-text-subtle',
                  disabled && 'cursor-not-allowed text-text-subtle/50',
                  !disabled && !selected && 'hover:bg-surface-muted',
                  selected && 'bg-primary font-semibold text-primary-foreground',
                  isToday && !selected && 'font-bold text-primary ring-1 ring-primary/40',
                )}
              >
                {d.getDate()}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
