import { useState } from 'react'
import { useNavigate } from 'react-router'

import { Button } from '@/components/ui/button'
import { parseBirthYear, SEX_OPTIONS, type Sex } from '@/lib/bodyProfile'
import { parseMeasure, RANGES } from '@/lib/measure'
import { saveOnboardingBody, saveProfileBasics } from '@/services/session'
import { useOnboardingStore } from '@/stores/onboardingStore'

import { MeasureField, RadioList } from './OnboardingFields'
import { OnboardingShell } from './OnboardingShell'

/** 온보딩 2/4 — 성별·출생연도·키(모두 선택) + 현재 체중 */
export function BodyStep() {
  const navigate = useNavigate()
  const { sex, birthYear, heightCm, weightKg, baselineSavedAt, set } = useOnboardingStore()
  const by = parseBirthYear(birthYear)
  const h = parseMeasure(heightCm, RANGES.height.min, RANGES.height.max, 'cm')
  const w = parseMeasure(weightKg, RANGES.weight.min, RANGES.weight.max, 'kg')
  const canNext = w.value !== null && !h.error && !by.error

  const [saving, setSaving] = useState(false)
  const next = async () => {
    if (w.value === null) return
    // 최초 체중 기록은 한 번만 만든다 — 다시 들어와 고치면 같은 기록을 갱신 (중복 저장 방지)
    setSaving(true)
    const ok = await saveOnboardingBody({ heightCm: h.value, weightKg: w.value, sex, birthYear: by.value })
    setSaving(false)
    if (!ok) return
    set({ step: 'goal', bodySkipped: false, baselineSavedAt: baselineSavedAt ?? new Date().toISOString() })
    navigate('/onboarding/goal')
  }
  const skip = async () => {
    // 체중은 비워도 고른 성별·출생연도는 저장
    setSaving(true)
    const ok = await saveProfileBasics({ sex, birthYear: by.error ? null : by.value }, 2)
    setSaving(false)
    if (!ok) return
    set({ step: 'goal', bodySkipped: true })
    navigate('/onboarding/goal')
  }

  return (
    <OnboardingShell
      step={2}
      title="기본 신체 정보를 알려주세요"
      description="체중 변화와 건강 목표를 관리하는 데 사용해요."
      footer={
        <div className="space-y-1">
          <Button size="lg" className="h-[52px] w-full" disabled={!canNext || saving} onClick={next}>
            {saving ? '저장 중…' : '다음'}
          </Button>
          <div className="flex justify-between">
            <Button variant="ghost" size="sm" className="h-10" onClick={() => navigate('/onboarding/nickname')}>
              이전
            </Button>
            <Button variant="ghost" size="sm" className="h-10" disabled={saving} onClick={skip}>
              나중에 입력
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-5 rounded-3xl border border-border bg-surface p-5">
        <RadioList<Sex | null> label="성별" optional options={SEX_OPTIONS} value={sex} onChange={(v) => set({ sex: v })} />
        <MeasureField id="birthYear" label="출생연도" unit="년" optional inputMode="numeric" placeholder="예: 1990" value={birthYear} error={by.error} onChange={(v) => set({ birthYear: v })} />
        <MeasureField id="heightCm" label="키" unit="cm" optional value={heightCm} error={h.error} onChange={(v) => set({ heightCm: v })} />
        <MeasureField id="weightKg" label="현재 체중" unit="kg" value={weightKg} error={w.error} onChange={(v) => set({ weightKg: v })} />
      </div>
      <p className="mt-4 text-[13px] leading-relaxed break-keep text-text-subtle">
        성별·출생연도는 하루 열량을 참고로 계산할 때만 써요. 안 넣어도 되고, 마이페이지에서 언제든 바꿀 수 있어요.
      </p>
    </OnboardingShell>
  )
}
