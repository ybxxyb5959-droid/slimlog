import { Calculator, ChevronDown } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'

import { BottomSheet } from '@/components/common/BottomSheet'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ACTIVITY_OPTIONS, parseBirthYear, SEX_OPTIONS, type ActivityLevel, type Sex } from '@/lib/bodyProfile'
import { parseMeasure, RANGES } from '@/lib/measure'
import { MACRO_META } from '@/lib/nutritionMeta'
import { calcTarget, FAT_RATIO, KCAL_FLOOR, KCAL_PER_KG_FAT, MAX_DEFICIT_RATIO, PROTEIN_MIN_G, PROTEIN_PER_KG, WEEKLY_LOSS_RATE, type TargetResult } from '@/lib/nutritionTarget'
import { dbErrorMessage, isLive } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { useBodyLogs } from '@/services/body'
import { saveNutritionGoals } from '@/services/goals'
import { updateHealth } from '@/services/live/account'
import { useMyProfile } from '@/services/profile'
import { isNewUser } from '@/services/session'
import { useAuthStore } from '@/stores/authStore'
import { useOnboardingStore } from '@/stores/onboardingStore'

const SEX_LABEL: Record<Sex, string> = { female: '여성', male: '남성' }
const n = (v: number) => v.toLocaleString()

/**
 * 하루 영양 목표 — 신체 정보로 '참고' 목표를 계산해 보여 주고,
 * '내 목표로 쓰기'를 눌러야 저장한다. 비어 있는 정보(성별·출생연도·키)는 이 화면에서 바로 채울 수 있다.
 */
export function NutritionGoalSheet({ open, onClose, onManual }: { open: boolean; onClose: () => void; onManual: () => void }) {
  return (
    <BottomSheet open={open} onRequestClose={onClose} title="하루 영양 목표" description="내 신체 정보를 바탕으로 참고 목표를 계산해요.">
      {open && <GoalBody onClose={onClose} onManual={onManual} />}
    </BottomSheet>
  )
}

function GoalBody({ onClose, onManual }: { onClose: () => void; onManual: () => void }) {
  const p = useMyProfile()
  const logs = useBodyLogs()
  const weightKg = logs.at(-1)?.weightKg ?? p.startWeightKg
  // 비어 있는 정보는 여기서 채움
  const [sex, setSex] = useState<Sex | null>(p.sex)
  const [birth, setBirth] = useState(p.birthYear?.toString() ?? '')
  const [height, setHeight] = useState(p.heightCm?.toString() ?? '')
  const [activity, setActivity] = useState<ActivityLevel | null>(p.activity)
  const [busy, setBusy] = useState(false)
  const by = parseBirthYear(birth)
  const h = parseMeasure(height, RANGES.height.min, RANGES.height.max, 'cm')
  const missing = { sex: !p.sex, birth: !p.birthYear, height: !p.heightCm }
  const ready = sex !== null && by.value !== null && h.value !== null && weightKg !== null
  const r = ready ? calcTarget({ sex: sex!, birthYear: by.value!, heightCm: h.value!, weightKg: weightKg!, goalWeightKg: p.goalWeightKg, activity }) : null

  const useAsGoal = async () => {
    if (!r) return
    setBusy(true)
    try {
      // 이 화면에서 새로 채운 신체 정보도 함께 저장
      const basics = {
        ...(missing.sex && { sex }),
        ...(missing.birth && { birth_year: by.value }),
        ...(missing.height && { height_cm: h.value }),
      }
      const account = useAuthStore.getState().account
      if (isLive && account && Object.keys(basics).length) {
        await updateHealth(account.userId, basics)
        useAuthStore.setState({ account: { ...account, sex: sex ?? account.sex, birthYear: by.value ?? account.birthYear, heightCm: h.value ?? account.heightCm } })
      }
      await saveNutritionGoals({ kcal: r.kcal, carbG: r.carbG, proteinG: r.proteinG, fatG: r.fatG }, activity !== p.activity ? { activity } : {})
      if (!isLive && isNewUser()) useOnboardingStore.getState().set({ sex, birthYear: birth, heightCm: height, activity })
      toast.success(isLive ? '하루 영양 목표를 저장했어요' : '목업: 화면에만 저장됐어요', { description: `${n(r.kcal)}kcal · 탄 ${r.carbG}g · 단 ${r.proteinG}g · 지 ${r.fatG}g` })
      onClose()
    } catch (e) {
      toast.error('저장하지 못했어요', { description: dbErrorMessage(e) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4 pb-1">
      <div className="flex items-center justify-between gap-2">
        <p className="tabular text-[13px] text-text-muted">
          {[sex && SEX_LABEL[sex], by.value && `${by.value}년생`, h.value && `${h.value}cm`, weightKg && `${weightKg}kg`].filter(Boolean).join(' · ') || '신체 정보 없음'}
        </p>
        {p.isExample ? (
          <Badge>예시 정보</Badge>
        ) : (
          <Link to="/my/body" onClick={onClose} className="shrink-0 text-[12px] font-medium text-primary underline-offset-2 hover:underline">
            정보 수정
          </Link>
        )}
      </div>

      {(missing.sex || missing.birth || missing.height) && (
        <section aria-label="계산에 필요한 정보" className="space-y-3 rounded-2xl border border-border p-4">
          <p className="text-[13px] font-semibold">계산에 필요한 정보를 채워 주세요</p>
          {missing.sex && (
            <div role="radiogroup" aria-label="성별" className="grid grid-cols-2 gap-1 rounded-full bg-surface-muted p-1">
              {SEX_OPTIONS.map((o) => (
                <button key={o.value} type="button" role="radio" aria-checked={sex === o.value} onClick={() => setSex(o.value)} className={cn('h-9 rounded-full text-[14px] font-medium', sex === o.value ? 'bg-surface font-semibold shadow-[0_1px_2px_rgba(15,23,42,0.08)]' : 'text-text-muted')}>
                  {o.label}
                </button>
              ))}
            </div>
          )}
          {missing.birth && <Field id="goalBirth" label="출생연도" unit="년" placeholder="예: 1990" value={birth} onChange={setBirth} error={by.error} />}
          {missing.height && <Field id="goalHeight" label="키" unit="cm" value={height} onChange={setHeight} error={h.error} />}
        </section>
      )}

      {weightKg === null ? (
        <div className="rounded-2xl bg-surface-muted px-4 py-5 text-center text-[14px] text-text-muted">
          체중 기록이 있어야 계산할 수 있어요.
          <Button asChild size="sm" className="mt-3 w-full">
            <Link to="/record/body" onClick={onClose}>
              체중 기록하기
            </Link>
          </Button>
        </div>
      ) : r ? (
        <>
          <section aria-label="하루 참고 열량" className="rounded-3xl bg-surface-muted px-5 py-6 text-center">
            <p className="text-[14px] font-medium text-text-muted">하루 참고 열량</p>
            <p className="mt-1">
              <span className="tabular text-[40px] leading-none font-bold tracking-tight">{n(r.kcal)}</span>
              <span className="ml-1 text-[18px] font-semibold text-text-muted">kcal</span>
            </p>
            <p className="mt-2 text-[13px] text-text-muted">체중 감량을 위한 참고 계산값</p>
          </section>

          <ul className="grid grid-cols-3 gap-2" aria-label="탄수화물·단백질·지방 참고량">
            {MACRO_META.map((m) => (
              <li key={m.key} className="flex flex-col items-center rounded-2xl border border-border px-2 py-3.5">
                <span aria-hidden className="inline-flex size-9 items-center justify-center rounded-full" style={{ background: `color-mix(in srgb, ${m.color} 16%, transparent)`, color: m.color }}>
                  <m.icon size={18} strokeWidth={1.9} />
                </span>
                <span className="mt-1.5 text-[13px] text-text-muted">{m.label}</span>
                <span className="tabular text-[22px] leading-tight font-bold">
                  {r[m.key]}
                  <span className="text-[14px]">g</span>
                </span>
              </li>
            ))}
          </ul>

          <div>
            <div className="mb-1.5 flex items-baseline justify-between">
              <label htmlFor="goalActivity" className="text-[14px] font-semibold">
                평소 활동량
              </label>
              <span className="text-[12px] text-text-muted">변경하면 다시 계산돼요</span>
            </div>
            <div className="relative">
              <select
                id="goalActivity"
                value={activity ?? ''}
                onChange={(e) => setActivity((e.target.value || null) as ActivityLevel | null)}
                className="h-12 w-full appearance-none rounded-full border border-border bg-surface pr-10 pl-5 text-[15px] text-text"
              >
                {activity === null && <option value="">아직 안 골랐어요 (거의 앉아서 생활로 계산)</option>}
                {ACTIVITY_OPTIONS.map((a) => (
                  <option key={a.value} value={a.value}>
                    {a.label}
                  </option>
                ))}
              </select>
              <ChevronDown size={18} aria-hidden className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-text-muted" />
            </div>
          </div>

          <HowCalculated r={r} weightKg={weightKg} heightCm={h.value!} sex={sex!} />

          <div className="space-y-2 pt-1">
            <Button size="lg" className="w-full rounded-full" disabled={busy} onClick={useAsGoal}>
              {busy ? '저장 중…' : '내 목표로 쓰기'}
            </Button>
            <Button size="lg" variant="outline" className="w-full rounded-full" onClick={onManual}>
              직접 정할게요
            </Button>
          </div>
          <p className="text-[12px] leading-relaxed text-text-subtle">
            참고용 계산이에요. 병원·영양사와 정한 목표가 있으면 그 값을 써 주세요. 식욕이 줄어 다 먹기 어려운 날엔 단백질부터 채워 보세요.
          </p>
        </>
      ) : null}
    </div>
  )
}

function Field({ id, label, unit, value, onChange, error, placeholder }: { id: string; label: string; unit: string; value: string; onChange: (v: string) => void; error: string | null; placeholder?: string }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-[13px] text-text-muted">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <Input id={id} inputMode="numeric" placeholder={placeholder} value={value} aria-invalid={!!error} onChange={(e) => onChange(e.target.value)} className="tabular h-11 flex-1" />
        <span className="w-8 text-[14px] font-semibold text-text-muted">{unit}</span>
      </div>
      {error && <p className="mt-1 text-[12px] text-danger">{error}</p>}
    </div>
  )
}

function HowCalculated({ r, weightKg, heightCm, sex }: { r: TargetResult; weightKg: number; heightCm: number; sex: Sex }) {
  const act = ACTIVITY_OPTIONS.find((a) => a.value === r.activity)!
  const basisNote = r.proteinBasis === 'goal' ? ' (BMI 25 이상이라 목표 체중 기준)' : r.proteinBasis === 'bmi25' ? ' (BMI 25 이상이라 BMI 25 체중 기준)' : ''
  return (
    <details className="group rounded-2xl bg-surface-muted">
      <summary className="flex min-h-14 cursor-pointer list-none items-center gap-2.5 px-4 text-[15px] font-semibold [&::-webkit-details-marker]:hidden">
        <Calculator size={18} strokeWidth={1.75} aria-hidden className="text-text-muted" />
        어떻게 계산했나요?
        <ChevronDown size={18} aria-hidden className="ml-auto text-text-muted transition-transform group-open:rotate-180" />
      </summary>
      <ol className="tabular space-y-2.5 px-4 pb-4 text-[13px] leading-relaxed text-text-muted">
        <li>
          <b className="text-text">1. 기초대사량</b> (Mifflin-St Jeor 공식)
          <br />
          10×{weightKg} + 6.25×{heightCm} − 5×{r.age} {sex === 'male' ? '+ 5' : '− 161'} = <b className="text-text">{n(r.bmr)}kcal</b>
        </li>
        <li>
          <b className="text-text">2. 유지 열량</b> (지금 체중을 유지하는 열량)
          <br />
          {n(r.bmr)} × {act.factor} ({act.label}
          {r.activityAssumed ? ' · 안 골라서 가정' : ''}) = <b className="text-text">{n(r.tdee)}kcal</b>
        </li>
        <li>
          <b className="text-text">3. 감량용 열량</b>
          <br />
          {r.mode === 'maintain' ? (
            <>목표 체중에 이미 닿아서 유지 열량을 그대로 써요.</>
          ) : (
            <>
              주 {WEEKLY_LOSS_RATE * 100}% 감량 속도: {weightKg} × {WEEKLY_LOSS_RATE * 100}% × {n(KCAL_PER_KG_FAT)} ÷ 7 = 하루 {n(r.deficitByRate)}kcal 줄이기
              {r.deficitCapped && ` → 유지 열량의 ${MAX_DEFICIT_RATIO * 100}%까지만 줄여요`}
              <br />
              {n(r.tdee)} − {n(r.deficit)} ≈ <b className="text-text">{n(r.kcal)}kcal</b>
              {r.floored && ` · 너무 낮게 나와서 최저선 ${n(KCAL_FLOOR[sex])}kcal로 맞췄어요`}
              <br />이대로면 일주일에 약 {r.weeklyLossKg}kg{r.weeksToGoal ? ` · 목표 체중까지 약 ${r.weeksToGoal}주` : ''} (참고값)
            </>
          )}
        </li>
        <li>
          <b className="text-text">4. 단백질</b> — 감량 중 근육 유지용
          <br />
          {r.proteinBasisKg}kg × {PROTEIN_PER_KG}g = <b className="text-text">{r.proteinG}g</b>
          {basisNote}
          {Math.round(r.proteinBasisKg * PROTEIN_PER_KG) < PROTEIN_MIN_G && ` · 최소 ${PROTEIN_MIN_G}g로 맞췄어요`}
        </li>
        <li>
          <b className="text-text">5. 지방</b>
          <br />
          {n(r.kcal)} × {FAT_RATIO * 100}% ÷ 9 = <b className="text-text">{r.fatG}g</b>
        </li>
        <li>
          <b className="text-text">6. 탄수화물</b> — 남은 열량
          <br />({n(r.kcal)} − {r.proteinG}×4 − {r.fatG}×9) ÷ 4 = <b className="text-text">{r.carbG}g</b>
        </li>
      </ol>
    </details>
  )
}
