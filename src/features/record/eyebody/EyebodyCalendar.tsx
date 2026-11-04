import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { useRef, useState } from 'react'

import { addDays, startOfDay, toDateKey } from '@/lib/date'
import { cn } from '@/lib/utils'

const WEEK = ['일', '월', '화', '수', '목', '금', '토']

/**
 * 눈바디 기록 캘린더 — 화면 아래에 붙는 패널 (기본 펼침)
 * - 사진이 있는 날만 초록 점, 오늘 표시, 미래 날짜는 선택 불가
 * - 손잡이를 위/아래로 끌거나 제목줄을 누르면 접기·펼치기
 * - 화면 위에 덮지 않고 내용 아래에 이어 붙어서, 작은 화면에서도 사진과 겹치지 않는다
 */
export function EyebodyCalendar({
  value,
  onChange,
  marked,
  open,
  onOpenChange,
}: {
  value: string
  onChange: (key: string) => void
  marked: Set<string>
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const today = startOfDay(new Date())
  const [month, setMonth] = useState(() => {
    const d = new Date(`${value}T12:00:00`)
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })
  const drag = useRef<{ y: number; moved: boolean } | null>(null)

  const first = new Date(month.getFullYear(), month.getMonth(), 1)
  const days = Array.from({ length: 42 }, (_, i) => addDays(first, i - first.getDay()))
  const cells = days.slice(35).some((d) => d.getMonth() === month.getMonth()) ? days : days.slice(0, 35)
  const nextDisabled = new Date(month.getFullYear(), month.getMonth() + 1, 1) > today

  const onPointerDown = (e: React.PointerEvent) => {
    drag.current = { y: e.clientY, moved: false }
    ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d) return
    const dy = e.clientY - d.y
    if (Math.abs(dy) > 36 && !d.moved) {
      d.moved = true
      onOpenChange(dy < 0)
    }
  }
  const onPointerUp = () => {
    const d = drag.current
    drag.current = null
    if (d && !d.moved) onOpenChange(!open)
  }

  return (
    <section aria-label="기록 캘린더" className="rounded-t-3xl border border-b-0 border-border bg-surface px-4 pt-2 pb-4 shadow-[0_-4px_16px_rgba(15,23,42,0.04)]">
      <div
        role="button"
        tabIndex={0}
        aria-expanded={open}
        aria-label={open ? '기록 캘린더 접기' : '기록 캘린더 펼치기'}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onOpenChange(!open)
          }
        }}
        className="cursor-grab touch-none select-none outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded-2xl"
      >
        <span aria-hidden className="mx-auto block h-1.5 w-10 rounded-full bg-border" />
        <span className="mt-2 flex min-h-10 items-center justify-between px-1">
          <span className="text-[16px] font-bold">기록 캘린더</span>
          <ChevronDown size={20} aria-hidden className={cn('text-text-muted transition-transform', open ? '' : 'rotate-180')} />
        </span>
      </div>

      {open && (
        <div className="mt-1">
          <div className="flex items-center justify-between">
            <button type="button" aria-label="이전 달" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} className="inline-flex size-10 items-center justify-center rounded-full hover:bg-surface-muted">
              <ChevronLeft size={20} aria-hidden />
            </button>
            <p className="tabular text-[16px] font-semibold" aria-live="polite">
              {month.getFullYear()}년 {month.getMonth() + 1}월
            </p>
            <button
              type="button"
              aria-label="다음 달"
              disabled={nextDisabled}
              onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
              className="inline-flex size-10 items-center justify-center rounded-full hover:bg-surface-muted disabled:opacity-30"
            >
              <ChevronRight size={20} aria-hidden />
            </button>
          </div>
          <div className="mt-1 grid grid-cols-7 text-center text-[12px] text-text-muted" aria-hidden>
            {WEEK.map((w) => (
              <span key={w} className="py-1">
                {w}
              </span>
            ))}
          </div>
          <div role="grid" aria-label={`${month.getFullYear()}년 ${month.getMonth() + 1}월`} className="grid grid-cols-7 gap-y-0.5">
            {cells.map((d) => {
              const k = toDateKey(d)
              const inMonth = d.getMonth() === month.getMonth()
              const future = startOfDay(d) > today
              const selected = k === value
              const isToday = startOfDay(d).getTime() === today.getTime()
              const has = marked.has(k)
              return (
                <button
                  key={k}
                  type="button"
                  role="gridcell"
                  aria-selected={selected}
                  aria-label={`${d.getMonth() + 1}월 ${d.getDate()}일${has ? ', 사진 있음' : ''}${isToday ? ', 오늘' : ''}`}
                  disabled={future}
                  onClick={() => {
                    onChange(k)
                    if (!inMonth) setMonth(new Date(d.getFullYear(), d.getMonth(), 1))
                  }}
                  className={cn(
                    'tabular mx-auto flex h-11 w-11 flex-col items-center justify-center rounded-2xl text-[15px] transition-colors disabled:opacity-30',
                    !inMonth && 'text-text-subtle',
                    selected ? 'bg-primary-soft font-bold text-primary' : 'hover:bg-surface-muted',
                    isToday && !selected && 'font-semibold text-primary',
                  )}
                >
                  {d.getDate()}
                  <span aria-hidden className={cn('mt-0.5 size-1.5 rounded-full', has ? 'bg-primary' : 'bg-transparent')} />
                </button>
              )
            })}
          </div>
          <p className="mt-2 flex items-center justify-center gap-1.5 text-[12px] text-text-muted">
            <span aria-hidden className="size-1.5 rounded-full bg-primary" /> 눈바디 사진이 등록된 날짜
          </p>
        </div>
      )}
    </section>
  )
}
