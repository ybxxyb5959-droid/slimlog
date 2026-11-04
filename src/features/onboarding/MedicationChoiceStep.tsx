import { CalendarRange, CircleCheck, Clock3, Syringe, type LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'

import { AppIcon } from '@/components/common/AppIcon'
import { Button } from '@/components/ui/button'
import { EMPTY_DRAFT, type FirstDoseDraft } from '@/features/record/first-dose/firstDoseDraft'
import { FirstDoseFlow } from '@/features/record/first-dose/FirstDoseFlow'
import { cn } from '@/lib/utils'
import { completeOnboarding, saveOnboardingDose, saveOnboardingSeries } from '@/services/session'
import { useOnboardingStore } from '@/stores/onboardingStore'

import { OnboardingShell } from './OnboardingShell'

function ChoiceCard({
  selected,
  onSelect,
  icon,
  title,
  description,
}: {
  selected: boolean
  onSelect: () => void
  icon: LucideIcon
  title: string
  description: string
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        'flex w-full flex-col rounded-3xl border-2 p-5 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
        selected ? 'border-primary bg-primary-soft' : 'border-border bg-surface hover:bg-surface-muted/60',
      )}
    >
      <div className="flex items-start justify-between">
        <AppIcon icon={icon} size="lg" bg={selected ? 'success' : 'neutral'} tone={selected ? 'success' : 'muted'} className="size-12 rounded-2xl bg-surface" />
        <span aria-hidden className={cn('inline-flex size-7 items-center justify-center rounded-full', selected ? 'text-primary' : 'border-2 border-border')}>
          {selected && <CircleCheck size={26} strokeWidth={1.75} />}
        </span>
      </div>
      <span className="mt-4 text-[18px] font-bold text-text">{title}</span>
      <span className="mt-1 text-[14px] leading-relaxed text-text-muted">{description}</span>
    </button>
  )
}

export function MedicationChoiceStep() {
  const navigate = useNavigate()
  const { doseChoice, set } = useOnboardingStore()
  // ongoing: 전부터 투약 중(첫 날부터 7일 간격 자동) · first: 첫 투약(날짜 하나) · later: 나중에
  const [choice, setChoice] = useState<'ongoing' | 'first' | 'later' | null>(doseChoice === 'later' ? 'later' : null)
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<FirstDoseDraft>(EMPTY_DRAFT)
  const [step, setStep] = useState(1)

  const start = async () => {
    if (choice === 'later') {
      // 가입 완료 → 영양 목표 제안(선택, 한 번만) → 홈
      if (await completeOnboarding('later')) navigate('/onboarding/nutrition-goal', { replace: true })
    } else if (choice) {
      // 프로필·신체정보는 이미 저장된 상태 → 투약 기록을 취소해도 유지된다
      set({ doseChoice: 'now' })
      setOpen(true)
    }
  }

  return (
    <OnboardingShell
      step={4}
      title={
        <>
          투약 내역도
          <br />
          기록해 볼까요?
        </>
      }
      description="이미 투약한 내역이 있다면 지금 남겨 보세요. 나중에 시작해도 괜찮아요."
      footer={
        <div className="space-y-1">
          <Button size="lg" className="h-[52px] w-full" disabled={!choice} onClick={start}>
            {choice && choice !== 'later' ? '투약 기록 시작하기' : '슬림로그 시작하기'}
          </Button>
          <Button variant="ghost" size="sm" className="h-10" onClick={() => navigate('/onboarding/goal')}>
            이전
          </Button>
        </div>
      }
    >
      <div role="radiogroup" aria-label="투약 기록 여부" className="space-y-3">
        <ChoiceCard
          selected={choice === 'ongoing'}
          onSelect={() => setChoice('ongoing')}
          icon={CalendarRange}
          title="전부터 투약 중이에요"
          description="처음 맞은 날만 고르면 오늘까지 7일 간격으로 채워 드려요. 다른 날짜는 고칠 수 있어요."
        />
        <ChoiceCard
          selected={choice === 'first'}
          onSelect={() => setChoice('first')}
          icon={Syringe}
          title="첫 투약이에요"
          description="처음 맞은 날짜와 시간 하나만 기록해요."
        />
        <ChoiceCard
          selected={choice === 'later'}
          onSelect={() => setChoice('later')}
          icon={Clock3}
          title="나중에 기록할게요"
          description="바로 홈으로 이동하고, 홈이나 기록 탭에서 언제든 기록할 수 있어요."
        />
      </div>
      <p className="mt-4 rounded-2xl bg-surface-muted px-4 py-3 text-[13px] leading-relaxed text-text-muted">
        실제로 맞은 투약 내역을 기록하는 기능이에요. 투약 시작이나 용량 변경을 권유하지 않아요.
      </p>

      <FirstDoseFlow
        open={open}
        onOpenChange={setOpen}
        draft={draft}
        setDraft={setDraft}
        step={step}
        setStep={setStep}
        mode={choice === 'ongoing' ? 'series' : 'single'}
        onConfirmed={(d) => (choice === 'ongoing' ? saveOnboardingSeries(d) : saveOnboardingDose(d))}
        onFinished={async () => {
          // 완료 화면을 닫을 때 온보딩 완료 처리 (먼저 처리하면 완료 화면이 보이기 전에 홈으로 넘어감)
          if (await completeOnboarding('now')) navigate('/onboarding/nutrition-goal', { replace: true })
        }}
      />
    </OnboardingShell>
  )
}
