import { useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'

import { PageHeader } from '@/components/common/PageHeader'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ACTIVITY_OPTIONS, parseBirthYear, SEX_OPTIONS, type ActivityLevel, type Sex } from '@/lib/bodyProfile'
import { parseMeasure, RANGES } from '@/lib/measure'
import { isLive } from '@/lib/supabase'
import { useMyProfile } from '@/services/profile'
import { isNewUser, saveOnboardingBody } from '@/services/session'
import { useOnboardingStore } from '@/stores/onboardingStore'

import { RadioList } from '../onboarding/OnboardingFields'

const ACTIVITY_CHOICES: { value: ActivityLevel | null; label: string }[] = [{ value: null, label: '정하지 않음' }, ...ACTIVITY_OPTIONS]

/** 신체 정보 · 목표 관리 */
export function BodyGoalPage() {
  const navigate = useNavigate()
  const p = useMyProfile()
  const setOnboarding = useOnboardingStore((s) => s.set)
  const [height, setHeight] = useState(p.heightCm?.toString() ?? '')
  const [start, setStart] = useState(p.startWeightKg?.toString() ?? '')
  const [goal, setGoal] = useState(p.goalWeightKg?.toString() ?? '')
  const [sex, setSex] = useState<Sex | null>(p.sex)
  const [birth, setBirth] = useState(p.birthYear?.toString() ?? '')
  const [activity, setActivity] = useState<ActivityLevel | null>(p.activity)
  const by = parseBirthYear(birth)
  const h = parseMeasure(height, RANGES.height.min, RANGES.height.max, 'cm')
  const s = parseMeasure(start, RANGES.weight.min, RANGES.weight.max, 'kg')
  const g = parseMeasure(goal, RANGES.weight.min, RANGES.weight.max, 'kg')
  const diff = s.value !== null && g.value !== null ? Math.round((g.value - s.value) * 10) / 10 : null
  const hasError = !!(h.error || s.error || g.error || by.error)
  const [saving, setSaving] = useState(false)

  const fields = [
    { id: 'bodyHeight', label: '키', unit: 'cm', value: height, set: setHeight, err: h.error },
    { id: 'bodyStart', label: '시작 체중', unit: 'kg', value: start, set: setStart, err: s.error },
    { id: 'bodyGoal', label: '목표 체중', unit: 'kg', value: goal, set: setGoal, err: g.error },
  ]

  return (
    <>
      <PageHeader title="신체 정보 · 목표" back="/my" />
      <div className="space-y-4 md:max-w-lg">
        <Card className="space-y-5">
          {fields.map((f) => (
            <div key={f.id}>
              <label htmlFor={f.id} className="mb-2 block text-[14px] font-medium">
                {f.label}
              </label>
              <div className="flex items-center gap-3">
                <Input id={f.id} inputMode="decimal" value={f.value} aria-invalid={!!f.err} onChange={(e) => f.set(e.target.value)} className="tabular flex-1 rounded-2xl text-[17px]" />
                <span className="w-8 font-semibold text-text-muted">{f.unit}</span>
              </div>
              {f.err && <p className="mt-1.5 text-[13px] text-danger">{f.err}</p>}
            </div>
          ))}
        </Card>
        <Card className="space-y-5">
          <div>
            <h2 className="text-[15px] font-semibold">열량 참고 계산용 정보</h2>
            <p className="mt-0.5 text-[12px] text-text-muted">하루 열량을 참고로 계산할 때만 써요.</p>
          </div>
          <RadioList<Sex | null> label="성별" options={SEX_OPTIONS} value={sex} onChange={setSex} />
          <div>
            <label htmlFor="bodyBirth" className="mb-2 block text-[14px] font-medium">
              출생연도
            </label>
            <div className="flex items-center gap-3">
              <Input id="bodyBirth" inputMode="numeric" placeholder="예: 1990" value={birth} aria-invalid={!!by.error} onChange={(e) => setBirth(e.target.value)} className="tabular flex-1 rounded-2xl text-[17px]" />
              <span className="w-8 font-semibold text-text-muted">년</span>
            </div>
            {by.error && <p className="mt-1.5 text-[13px] text-danger">{by.error}</p>}
          </div>
          <RadioList<ActivityLevel | null> label="평소 활동량" options={ACTIVITY_CHOICES} value={activity} onChange={setActivity} />
        </Card>
        {diff !== null && (
          <div className="rounded-card bg-primary-soft px-5 py-4 text-center">
            <p className="text-[13px] text-primary/80">내가 설정한 목표 변화량</p>
            <p className="tabular text-[30px] font-bold text-primary">
              {diff > 0 ? '+' : diff < 0 ? '−' : ''}
              {Math.abs(diff).toFixed(1)}kg
            </p>
          </div>
        )}
        <p className="text-[12px] leading-relaxed text-text-subtle">
          목표는 내가 정하는 값이며 의학적 권장 체중이 아니에요. 시작 체중을 바꾸면 최초 체중 기록이 함께 고쳐지고 새 기록이 추가되지 않아요.
        </p>
        <Button
          size="lg"
          className="w-full"
          disabled={hasError || saving || (isLive && s.value === null)}
          onClick={async () => {
            if (isLive) {
              setSaving(true)
              // 시작 체중을 바꾸면 최초 체중 기록(is_baseline)을 함께 고친다 — 새 기록을 만들지 않음
              const ok = await saveOnboardingBody({ heightCm: h.value, weightKg: s.value!, goalKg: g.value, sex, birthYear: by.value, activity })
              setSaving(false)
              if (!ok) return
            }
            if (isNewUser()) setOnboarding({ heightCm: height, weightKg: start, goalKg: goal, sex, birthYear: birth, activity, bodySkipped: false })
            toast.success(isLive ? '신체 정보를 저장했어요' : '목업: 화면에만 저장됐어요')
            navigate('/my')
          }}
        >
          {saving ? '저장 중…' : '저장'}
        </Button>
      </div>
    </>
  )
}
