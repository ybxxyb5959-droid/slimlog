import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

/** 온보딩 공용 입력칸 — 숫자 + 단위 */
export function MeasureField({
  id,
  label,
  unit,
  value,
  error,
  onChange,
  optional,
  placeholder,
  inputMode = 'decimal',
}: {
  id: string
  label: string
  unit: string
  value: string
  error: string | null
  onChange: (v: string) => void
  optional?: boolean
  placeholder?: string
  inputMode?: 'decimal' | 'numeric'
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-[14px] font-medium text-text">
        {label} {optional && <span className="text-[12px] font-normal text-text-subtle">선택</span>}
      </label>
      <div className="flex items-center gap-3">
        <Input
          id={id}
          inputMode={inputMode}
          placeholder={placeholder}
          enterKeyHint="next"
          autoComplete="off"
          value={value}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={(e) => onChange(e.target.value)}
          onFocus={(e) => e.currentTarget.scrollIntoView({ block: 'center', behavior: 'smooth' })}
          className="tabular h-13 flex-1 rounded-2xl text-[17px]"
        />
        <span className="w-8 text-[16px] font-semibold text-text-muted">{unit}</span>
      </div>
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1.5 text-[13px] text-danger">
          {error}
        </p>
      )}
    </div>
  )
}


/** 온보딩 공용 큰 라디오 목록 (성별·활동량) */
export function RadioList<T extends string | null>({ label, optional, options, value, onChange }: { label: string; optional?: boolean; options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <fieldset>
      <legend className="mb-1 text-[14px] font-medium text-text">
        {label} {optional && <span className="text-[12px] font-normal text-text-subtle">선택</span>}
      </legend>
      <div role="radiogroup" aria-label={label}>
        {options.map((o) => {
          const on = o.value === value
          return (
            <button
              key={String(o.value)}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange(o.value)}
              className="flex min-h-12 w-full items-center gap-3 rounded-xl text-left text-[16px] outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              <span aria-hidden className={cn('inline-flex size-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors', on ? 'border-primary bg-primary' : 'border-border bg-surface')}>
                {on && <span className="size-2.5 rounded-full bg-surface" />}
              </span>
              {o.label}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}
