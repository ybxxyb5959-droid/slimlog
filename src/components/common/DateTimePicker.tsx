import { CalendarDays, Clock3 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { addDays, startOfDay, toDateKey } from '@/lib/date'
import { cn } from '@/lib/utils'

import { BottomSheet } from './BottomSheet'
import { Calendar } from './Calendar'

/**
 * 앱 디자인 날짜·시간 선택기 — 폰 기본 선택창(input type=date/time/datetime-local) 대신 쓴다.
 * 값은 기존 input 과 같은 문자열 형식이라 그대로 바꿔 끼울 수 있다:
 *   date → 'YYYY-MM-DD' · time → 'HH:MM' · datetime → 'YYYY-MM-DDTHH:MM' (기기 시간대)
 */
export type PickerMode = 'date' | 'time' | 'datetime'

const ROW = 44
const pad = (n: number) => String(n).padStart(2, '0')
const WEEK = ['일', '월', '화', '수', '목', '금', '토']

function parse(v: string, mode: PickerMode): { date: Date | null; time: string } {
  if (!v) return { date: null, time: '' }
  if (mode === 'time') return { date: null, time: v.slice(0, 5) }
  const [d, t] = v.split('T')
  const [y, m, day] = d.split('-').map(Number)
  if (!y || !m || !day) return { date: null, time: '' }
  return { date: new Date(y, m - 1, day), time: mode === 'datetime' ? (t ?? '').slice(0, 5) : '' }
}
function compose(date: Date | null, time: string, mode: PickerMode) {
  if (mode === 'time') return time
  if (!date) return ''
  return mode === 'date' ? toDateKey(date) : `${toDateKey(date)}T${time || '00:00'}`
}

export function formatPickerValue(v: string, mode: PickerMode) {
  const { date, time } = parse(v, mode)
  const t = (hhmm: string) => {
    const [h, m] = hhmm.split(':').map(Number)
    if (Number.isNaN(h) || Number.isNaN(m)) return ''
    return `${h < 12 ? '오전' : '오후'} ${h % 12 === 0 ? 12 : h % 12}:${pad(m)}`
  }
  if (mode === 'time') return time ? t(time) : ''
  if (!date) return ''
  const d = `${date.getMonth() + 1}월 ${date.getDate()}일 (${WEEK[date.getDay()]})`
  const yearPrefix = date.getFullYear() !== new Date().getFullYear() ? `${date.getFullYear()}년 ` : ''
  return mode === 'date' ? yearPrefix + d : `${yearPrefix}${d} ${time ? t(time) : ''}`.trim()
}

/** 스크롤 휠 한 줄 (오전/오후 · 시 · 분) */
function Wheel<T extends string | number>({ label, items, value, onChange }: { label: string; items: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const idx = Math.max(0, items.findIndex((i) => i.value === value))
  const timer = useRef<number | undefined>(undefined)
  const settling = useRef(false)
  useEffect(() => {
    const el = ref.current
    if (!el || Math.round(el.scrollTop / ROW) === idx) return
    settling.current = true
    el.scrollTop = idx * ROW
    window.setTimeout(() => (settling.current = false), 50)
  }, [idx])
  return (
    <div className="relative h-[220px] flex-1">
      <div aria-hidden className="pointer-events-none absolute inset-x-1 top-1/2 h-11 -translate-y-1/2 rounded-xl bg-surface-muted" />
      <div
        ref={ref}
        role="listbox"
        aria-label={label}
        tabIndex={0}
        onScroll={(e) => {
          if (settling.current) return
          const el = e.currentTarget
          window.clearTimeout(timer.current)
          timer.current = window.setTimeout(() => {
            const i = Math.min(items.length - 1, Math.max(0, Math.round(el.scrollTop / ROW)))
            if (items[i].value !== value) onChange(items[i].value)
          }, 90)
        }}
        onKeyDown={(e) => {
          if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
          e.preventDefault()
          const i = Math.min(items.length - 1, Math.max(0, idx + (e.key === 'ArrowDown' ? 1 : -1)))
          onChange(items[i].value)
        }}
        className="relative h-full snap-y snap-mandatory overflow-y-auto overscroll-contain py-[88px] outline-none [scrollbar-width:none] focus-visible:ring-2 focus-visible:ring-primary/40 rounded-xl [&::-webkit-scrollbar]:hidden"
      >
        {items.map((it) => (
          <button
            key={String(it.value)}
            type="button"
            role="option"
            aria-selected={it.value === value}
            tabIndex={-1}
            onClick={() => onChange(it.value)}
            className={cn('tabular block h-11 w-full snap-center text-center text-[20px] transition-colors', it.value === value ? 'font-bold text-text' : 'text-text-subtle')}
          >
            {it.label}
          </button>
        ))}
      </div>
    </div>
  )
}

const AMPM = [
  { value: 'am', label: '오전' },
  { value: 'pm', label: '오후' },
] as const
const HOURS = Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: String(i + 1) }))
const MINUTES = Array.from({ length: 60 }, (_, i) => ({ value: i, label: pad(i) }))

/** 시간 휠 (오전/오후 · 시 · 분) — 'HH:MM' */
export function TimeWheel({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [h24, m] = (value || '09:00').split(':').map(Number)
  const ap: 'am' | 'pm' = h24 < 12 ? 'am' : 'pm'
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12
  const set = (nap: 'am' | 'pm', nh: number, nm: number) => onChange(`${pad((nh % 12) + (nap === 'pm' ? 12 : 0))}:${pad(nm)}`)
  return (
    <div className="flex items-center gap-1">
      <Wheel label="오전/오후" items={[...AMPM]} value={ap} onChange={(v) => set(v, h12, m)} />
      <Wheel label="시" items={HOURS} value={h12} onChange={(v) => set(ap, v, m)} />
      <span aria-hidden className="text-[20px] font-bold text-text-muted">
        :
      </span>
      <Wheel label="분" items={MINUTES} value={m} onChange={(v) => set(ap, h12, v)} />
    </div>
  )
}

/** 날짜·시간 고르는 바텀시트 — [취소][선택]은 시트 아래에 고정 */
export function DateTimeSheet(props: {
  open: boolean
  onClose: () => void
  title: string
  mode: PickerMode
  value: string
  /** 이 시각 이후는 고를 수 없음 (같은 형식 문자열) */
  max?: string
  onConfirm: (v: string) => void
}) {
  // 열 때마다 지금 값으로 새로 시작
  return props.open ? <PickerSheet {...props} /> : null
}

function PickerSheet({ onClose, title, mode, value, max, onConfirm }: { onClose: () => void; title: string; mode: PickerMode; value: string; max?: string; onConfirm: (v: string) => void }) {
  const init = parse(value, mode)
  const now = new Date()
  const nowHm = `${pad(now.getHours())}:${pad(now.getMinutes())}`
  const [date, setDate] = useState<Date | null>(init.date ?? (mode === 'time' ? null : startOfDay(now)))
  const [time, setTime] = useState(init.time || nowHm)
  const out = compose(date, time, mode)
  const maxDate = max && mode !== 'time' ? parse(max, mode).date : null
  const over = !!max && !!out && out > max
  const today = startOfDay(now)
  return (
    <BottomSheet
      open
      onRequestClose={onClose}
      title={title}
      footer={
        <div className="space-y-2">
          {over && (
            <p role="alert" className="text-[13px] text-danger">
              아직 지나지 않은 시각은 고를 수 없어요.
            </p>
          )}
          <div className="grid grid-cols-[1fr_2fr] gap-2">
            <Button variant="outline" size="lg" onClick={onClose}>
              취소
            </Button>
            <Button
              size="lg"
              disabled={!out || over}
              onClick={() => {
                onConfirm(out)
                onClose()
              }}
            >
              선택
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4 pb-1">
        {mode !== 'time' && (
          <>
            <div className="flex gap-2">
              {[
                { label: '오늘', d: today },
                { label: '어제', d: addDays(today, -1) },
              ].map((q) => (
                <button
                  key={q.label}
                  type="button"
                  aria-pressed={!!date && startOfDay(date).getTime() === q.d.getTime()}
                  onClick={() => setDate(q.d)}
                  className={cn(
                    'h-10 flex-1 rounded-xl border text-[14px] font-medium',
                    date && startOfDay(date).getTime() === q.d.getTime() ? 'border-primary bg-primary-soft font-semibold text-primary' : 'border-border bg-surface hover:bg-surface-muted',
                  )}
                >
                  {q.label}
                </button>
              ))}
            </div>
            {/* 고른 날짜의 달이 바뀌면(오늘·어제 버튼 등) 달력도 그 달로 */}
            <Calendar key={date ? `${date.getFullYear()}-${date.getMonth()}` : 'none'} value={date} onChange={setDate} maxDate={maxDate ?? undefined} />
          </>
        )}
        {mode !== 'date' && (
          <div>
            <div className="mb-1 flex items-center justify-between">
              <p className="text-[14px] font-semibold">시간</p>
              <button type="button" onClick={() => setTime(nowHm)} className="h-9 rounded-lg px-3 text-[13px] font-medium text-primary hover:bg-primary-soft">
                지금
              </button>
            </div>
            <TimeWheel value={time} onChange={setTime} />
          </div>
        )}
      </div>
    </BottomSheet>
  )
}

/**
 * 입력칸처럼 보이는 버튼 → 누르면 DateTimeSheet.
 * label 은 화면 읽기·테스트용 이름 (보이는 라벨은 <label htmlFor={id}> 로 따로 둬도 됨)
 */
export function DateTimeField({
  id,
  label,
  mode,
  value,
  onChange,
  max,
  placeholder,
  invalid,
  disabled,
  className,
  sheetTitle,
}: {
  id?: string
  label: string
  mode: PickerMode
  value: string
  onChange: (v: string) => void
  max?: string
  placeholder?: string
  invalid?: boolean
  disabled?: boolean
  className?: string
  sheetTitle?: string
}) {
  const [open, setOpen] = useState(false)
  const text = formatPickerValue(value, mode)
  const Icon = mode === 'time' ? Clock3 : CalendarDays
  return (
    <>
      <button
        id={id}
        type="button"
        aria-label={`${label}: ${text || '선택 안 함'}`}
        aria-haspopup="dialog"
        aria-invalid={invalid || undefined}
        disabled={disabled}
        onClick={() => setOpen(true)}
        className={cn(
          'tabular flex h-12 w-full items-center gap-2 rounded-xl border bg-surface px-4 text-left text-[15px] transition-colors hover:bg-surface-muted disabled:opacity-50',
          invalid ? 'border-danger' : 'border-border',
          className,
        )}
      >
        <Icon size={18} strokeWidth={1.75} aria-hidden className="shrink-0 text-text-muted" />
        <span className={cn('min-w-0 flex-1 truncate', !text && 'text-text-subtle')}>{text || placeholder || (mode === 'time' ? '시간 선택' : '날짜 선택')}</span>
      </button>
      <DateTimeSheet open={open} onClose={() => setOpen(false)} title={sheetTitle ?? label} mode={mode} value={value} max={max} onConfirm={onChange} />
    </>
  )
}
