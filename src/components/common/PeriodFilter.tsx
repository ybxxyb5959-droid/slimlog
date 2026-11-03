import { cn } from '@/lib/utils'

export type Period = 7 | 30 | 90
// eslint-disable-next-line react-refresh/only-export-components
export const PERIODS: { value: Period; label: string }[] = [
  { value: 7, label: '7일' },
  { value: 30, label: '30일' },
  { value: 90, label: '전체' },
]

/** 기간 필터 — 세그먼트 컨트롤 */
export function PeriodFilter({ value, onChange, className }: { value: Period; onChange: (p: Period) => void; className?: string }) {
  return (
    <div role="radiogroup" aria-label="기간" className={cn('inline-flex rounded-xl bg-surface-muted p-1', className)}>
      {PERIODS.map((p) => (
        <button
          key={p.value}
          type="button"
          role="radio"
          aria-checked={value === p.value}
          onClick={() => onChange(p.value)}
          className={cn(
            'h-9 min-w-14 rounded-lg px-3 text-[13px] font-medium transition-colors',
            value === p.value ? 'bg-surface font-semibold text-text shadow-[0_1px_2px_rgba(15,23,42,0.08)]' : 'text-text-muted',
          )}
        >
          {p.label}
        </button>
      ))}
    </div>
  )
}
