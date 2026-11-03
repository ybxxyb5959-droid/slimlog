import { CalendarDays, MapPin, Pill, Syringe, type LucideIcon } from 'lucide-react'
import { useState } from 'react'

import { AppIcon } from '@/components/common/AppIcon'
import { MockBadge } from '@/components/common/MockBadge'
import { PageHeader } from '@/components/common/PageHeader'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

import { EMPTY_DRAFT, isDirty, type FirstDoseDraft } from './firstDoseDraft'
import { FirstDoseFlow } from './FirstDoseFlow'

const STEPS: { icon: LucideIcon; label: string }[] = [
  { icon: Pill, label: '약물 선택' },
  { icon: Syringe, label: '용량 선택' },
  { icon: MapPin, label: '주사 부위' },
  { icon: CalendarDays, label: '날짜 · 시간' },
]

/** 가입 직후 첫 투약 등록 진입 화면 (목업) — 들어오면 바로 시트를 연다 */
export function FirstDosePage() {
  const [open, setOpen] = useState(true)
  const [draft, setDraft] = useState<FirstDoseDraft>(EMPTY_DRAFT)
  const [step, setStep] = useState(1)
  const resume = isDirty(draft) && step < 6

  return (
    <>
      <PageHeader title="첫 투약 기록" description="가입을 환영해요. 첫 투약부터 기록해 볼까요?" actions={<MockBadge label="목업 흐름" />} />
      <Card className="md:max-w-lg">
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
          {resume ? `이어서 기록하기 (${step}/5)` : '첫 투약 기록하기'}
        </Button>
        <p className="mt-3 text-[12px] text-text-subtle">처방받은 내용을 그대로 기록해 주세요. 앱은 용량이나 주사 부위를 추천하지 않아요.</p>
      </Card>
      <FirstDoseFlow open={open} onOpenChange={setOpen} draft={draft} setDraft={setDraft} step={step} setStep={setStep} />
    </>
  )
}
