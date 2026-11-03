import { cn } from '@/lib/utils'

export interface ChipOption<T extends string> {
  value: T
  label: string
  disabled?: boolean
}

/** 단일 선택 칩 (라디오 역할) */
export function ChipGroup<T extends string>({
  options,
  value,
  onChange,
  label,
  columns,
  className,
}: {
  options: ChipOption<T>[]
  value: T | null
  onChange: (value: T) => void
  label: string
  /** 지정하면 그리드(같은 폭), 없으면 줄바꿈 칩 */
  columns?: 2 | 3 | 4
  className?: string
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        columns ? 'grid gap-2' : 'flex flex-wrap gap-2',
        columns === 2 && 'grid-cols-2',
        columns === 3 && 'grid-cols-3',
        columns === 4 && 'grid-cols-2 sm:grid-cols-4',
        className,
      )}
    >
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={o.disabled}
            onClick={() => onChange(o.value)}
            className={cn(
              'h-11 min-w-0 truncate rounded-xl border px-4 text-[14px] font-medium transition-colors disabled:opacity-40',
              active
                ? 'border-primary bg-primary-soft font-semibold text-primary'
                : 'border-border bg-surface text-text hover:bg-surface-muted',
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
