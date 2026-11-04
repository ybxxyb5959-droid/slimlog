import { CalendarDays, MapPin, Pill, Syringe, type LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'

import { AppIcon } from '@/components/common/AppIcon'
import { PageHeader } from '@/components/common/PageHeader'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EMPTY_DRAFT, isDirty, type FirstDoseDraft } from '@/features/record/first-dose/firstDoseDraft'
import { FirstDoseFlow } from '@/features/record/first-dose/FirstDoseFlow'
import { MEDICATIONS } from '@/fixtures/medications.mock'
import { startOfDay } from '@/lib/date'
import { useDoses } from '@/services/doses'
import { setCurrentMedication } from '@/services/profile'
import { saveOnboardingDose } from '@/services/session'

import { ResidualPreviewCard } from './ResidualPreviewCard'

const STEPS: { icon: LucideIcon; label: string }[] = [
  { icon: Pill, label: '약물' },
  { icon: Syringe, label: '용량' },
  { icon: MapPin, label: '주사 부위' },
  { icon: CalendarDays, label: '날짜 · 시간' },
]

/**
 * /record/medication/new — 투약 추가도 첫 투약과 같은 5단계 바텀시트로 (들어오면 바로 열림)
 * 지난 투약의 약·용량을 미리 골라 두고, 날짜는 오늘. 주사 부위는 매번 직접 고른다.
 * 저장된 기록을 고칠 때는 /record/medication/:id 의 한 화면 폼을 쓴다.
 */
export function MedicationNewPage() {
  const navigate = useNavigate()
  const doses = useDoses()
  const last = doses[0]
  const initial = (): FirstDoseDraft =>
    last ? { ...EMPTY_DRAFT, medicationId: last.medicationId, doseMg: last.doseMg, date: startOfDay(new Date()) } : { ...EMPTY_DRAFT, date: startOfDay(new Date()) }
  const [open, setOpen] = useState(true)
  const [draft, setDraft] = useState<FirstDoseDraft>(initial)
  const [step, setStep] = useState(last ? 2 : 1)
  const resume = isDirty(draft) && step > (last ? 2 : 1) && step < 6
  const med = MEDICATIONS[draft.medicationId ?? last?.medicationId ?? 'mounjaro']

  return (
    <>
      <PageHeader title="투약 기록하기" back="/record/medication" />
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <Card>
          <p className="text-[15px] font-semibold">4가지만 고르면 끝나요</p>
          <ol className="mt-4 grid grid-cols-4 gap-2">
            {STEPS.map((s) => (
              <li key={s.label} className="flex flex-col items-center gap-1.5 text-center text-[12px] text-text-muted">
                <AppIcon icon={s.icon} bg="soft" />
                {s.label}
              </li>
            ))}
          </ol>
          <Button size="lg" className="mt-6 w-full" onClick={() => setOpen(true)}>
            {resume ? `이어서 기록하기 (${step}/5)` : '투약 기록 시작'}
          </Button>
          <p className="mt-3 text-[12px] text-text-subtle">처방받은 내용을 그대로 기록해 주세요. 앱은 용량이나 주사 부위를 추천하지 않아요.</p>
        </Card>
        <ResidualPreviewCard medication={med} doses={doses} />
      </div>
      <FirstDoseFlow
        open={open}
        onOpenChange={setOpen}
        draft={draft}
        setDraft={setDraft}
        step={step}
        setStep={setStep}
        previousMedId={last?.medicationId ?? null}
        onConfirmed={async (d) => {
          const ok = await saveOnboardingDose(d)
          // 약을 바꿔 기록했으면 '사용 중인 약'도 새 약으로
          if (ok && d.medicationId && last && d.medicationId !== last.medicationId) await setCurrentMedication(d.medicationId).catch(() => {})
          return ok
        }}
        onFinished={() => navigate('/record/medication')}
      />
    </>
  )
}
