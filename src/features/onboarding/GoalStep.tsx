import { Info } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'

import { Button } from '@/components/ui/button'
import { ACTIVITY_OPTIONS, type ActivityLevel } from '@/lib/bodyProfile'
import { parseMeasure, RANGES } from '@/lib/measure'
import { saveOnboardingGoal } from '@/services/session'
import { useOnboardingStore } from '@/stores/onboardingStore'

import { MeasureField, RadioList } from './OnboardingFields'
import { OnboardingShell } from './OnboardingShell'

const ACTIVITY_CHOICES: { value: ActivityLevel | null; label: string }[] = [{ value: null, label: '나중에 설정할게요' }, ...ACTIVITY_OPTIONS]

/** 온보딩 3/4 — 목표 체중 + 평소 활동량 (둘 다 선택) */
export function GoalStep() {
  const navigate = useNavigate()
  const { weightKg, goalKg, activity, set } = useOnboardingStore()
  const w = parseMeasure(weightKg, RANGES.weight.min, RANGES.weight.max, 'kg')
  const g = parseMeasure(goalKg, RANGES.weight.min, RANGES.weight.max, 'kg')
  const diff = w.value !== null && g.value !== null ? Math.round((g.value - w.value) * 10) / 10 : null
  const [saving, setSaving] = useState(false)

  const next = async () => {
    setSaving(true)
    const ok = await saveOnboardingGoal({ goalKg: g.value, activity })
    setSaving(false)
    if (!ok) return
    set({ step: 'medication' })
    navigate('/onboarding/medication')
  }

  return (
    <OnboardingShell
      step={3}
      title="어떤 목표를 가지고 있나요?"
      description="목표는 언제든 바꿀 수 있어요."
      footer={
        <div className="space-y-1">
          <Button size="lg" className="h-[52px] w-full" disabled={!!g.error || saving} onClick={next}>
            {saving ? '저장 중…' : '다음'}
          </Button>
          <div className="flex justify-start">
            <Button variant="ghost" size="sm" className="h-10" onClick={() => navigate('/onboarding/body')}>
              이전
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-5 rounded-3xl border border-border bg-surface p-5">
        <MeasureField id="goalKg" label="목표 체중" unit="kg" optional={w.value === null} value={goalKg} error={g.error} onChange={(v) => set({ goalKg: v })} />
        {diff !== null && (
          <section aria-live="polite" aria-label="목표 변화량" className="rounded-2xl bg-primary-soft px-4 py-4 text-center">
            <p className="text-[13px] font-medium text-primary/80">내가 설정한 목표 변화량</p>
            <p className="tabular mt-1 text-[34px] leading-none font-bold tracking-tight text-primary">
              {diff > 0 ? '+' : diff < 0 ? '−' : ''}
              {Math.abs(diff).toFixed(1)}
              <span className="ml-1 text-[18px] font-semibold">kg</span>
            </p>
            <p className="tabular mt-2 text-[13px] text-text-muted">
              현재 {w.value}kg → 목표 {g.value}kg
            </p>
          </section>
        )}
        <div className="border-t border-border pt-5">
          <RadioList<ActivityLevel | null> label="평소 활동량" optional options={ACTIVITY_CHOICES} value={activity} onChange={(v) => set({ activity: v })} />
        </div>
        <p className="flex gap-2 rounded-2xl bg-surface-muted px-4 py-3 text-[13px] leading-relaxed break-keep text-text-muted">
          <Info size={16} strokeWidth={1.75} aria-hidden className="mt-0.5 shrink-0" />
          활동량을 건너뛰면 하루 열량을 참고로 계산할 때 가장 낮은 활동량으로 가정하고, 결과에 그 가정을 함께 보여줘요.
        </p>
      </div>
      <p className="mt-4 text-[13px] leading-relaxed break-keep text-text-subtle">
        목표 체중은 내가 정하는 값이에요. 의학적 권장 체중이 아니며, 마이페이지에서 언제든 바꿀 수 있어요.
      </p>
    </OnboardingShell>
  )
}
