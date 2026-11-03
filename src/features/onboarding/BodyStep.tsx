import { useNavigate } from 'react-router'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { parseMeasure, RANGES } from '@/lib/measure'
import { cn } from '@/lib/utils'
import { useOnboardingStore } from '@/stores/onboardingStore'

import { OnboardingShell } from './OnboardingShell'

function MeasureField({
  id,
  label,
  unit,
  value,
  error,
  onChange,
  optional,
}: {
  id: string
  label: string
  unit: string
  value: string
  error: string | null
  onChange: (v: string) => void
  optional?: boolean
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-[14px] font-medium text-text">
        {label} {optional && <span className="text-[12px] font-normal text-text-subtle">(선택)</span>}
      </label>
      <div className="flex items-center gap-3">
        <Input
          id={id}
          inputMode="decimal"
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

export function BodyStep() {
  const navigate = useNavigate()
  const { heightCm, weightKg, goalKg, baselineSavedAt, set } = useOnboardingStore()
  const h = parseMeasure(heightCm, RANGES.height.min, RANGES.height.max, 'cm')
  const w = parseMeasure(weightKg, RANGES.weight.min, RANGES.weight.max, 'kg')
  const g = parseMeasure(goalKg, RANGES.weight.min, RANGES.weight.max, 'kg')
  const diff = w.value !== null && g.value !== null ? Math.round((g.value - w.value) * 10) / 10 : null
  const canNext = w.value !== null && g.value !== null && !h.error

  const next = () => {
    // 최초 체중 기록은 한 번만 만든다 — 다시 들어와 고치면 같은 기록을 갱신 (중복 저장 방지)
    set({ step: 'medication', bodySkipped: false, baselineSavedAt: baselineSavedAt ?? new Date().toISOString() })
    navigate('/onboarding/medication')
  }

  return (
    <OnboardingShell
      step={2}
      title={
        <>
          나의 시작점을
          <br />
          기록해 볼까요?
        </>
      }
      description="오늘의 정보를 기준으로 앞으로의 변화를 살펴볼 수 있어요."
      footer={
        <div className="space-y-1">
          <Button size="lg" className="h-[52px] w-full" disabled={!canNext} onClick={next}>
            다음
          </Button>
          <div className="flex justify-between">
            <Button variant="ghost" size="sm" className="h-10" onClick={() => navigate('/onboarding/nickname')}>
              이전
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-10"
              onClick={() => {
                set({ step: 'medication', bodySkipped: true })
                navigate('/onboarding/medication')
              }}
            >
              나중에 입력
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-5 rounded-3xl border border-border bg-surface p-5">
        <MeasureField id="heightCm" label="키" unit="cm" optional value={heightCm} error={h.error} onChange={(v) => set({ heightCm: v })} />
        <MeasureField id="weightKg" label="현재 체중" unit="kg" value={weightKg} error={w.error} onChange={(v) => set({ weightKg: v })} />
        <MeasureField id="goalKg" label="목표 체중" unit="kg" value={goalKg} error={g.error} onChange={(v) => set({ goalKg: v })} />
      </div>

      {diff !== null && w.value !== null && g.value !== null && (
        <section aria-live="polite" aria-label="목표 변화량" className="mt-4 rounded-3xl bg-primary-soft px-5 py-6 text-center">
          <p className="text-[14px] font-medium text-primary/80">내가 설정한 목표 변화량</p>
          <p className={cn('tabular mt-2 text-[44px] leading-none font-bold tracking-tight text-primary')}>
            {diff > 0 ? '+' : diff < 0 ? '−' : ''}
            {Math.abs(diff).toFixed(1)}
            <span className="ml-1 text-[22px] font-semibold">kg</span>
          </p>
          <p className="tabular mt-3 text-[14px] text-text-muted">
            현재 {w.value}kg → 목표 {g.value}kg
          </p>
        </section>
      )}

      <p className="mt-4 text-[13px] leading-relaxed break-keep text-text-subtle">
        목표 체중은 내가 정하는 값이에요. 의학적 권장 체중이 아니며, 마이페이지에서 언제든 바꿀 수 있어요.
      </p>
    </OnboardingShell>
  )
}
