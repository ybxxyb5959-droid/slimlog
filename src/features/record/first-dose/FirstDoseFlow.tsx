import { ChevronLeft, CircleCheck } from 'lucide-react'
import { useState } from 'react'

import { AppIcon } from '@/components/common/AppIcon'
import { BottomSheet } from '@/components/common/BottomSheet'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { MEDICATIONS, siteLabel } from '@/fixtures/medications.mock'
import { formatFullDate } from '@/lib/date'

import { dateTimeError, EMPTY_DRAFT, isDirty, type FirstDoseDraft } from './firstDoseDraft'
import { StepDateTime, StepDose, StepMedication, StepSite } from './steps'

const TOTAL = 5
const TITLES: Record<number, { title: string; description?: string }> = {
  1: { title: '어떤 약을 맞으셨나요?', description: '처방받은 약을 골라 주세요.' },
  2: { title: '투여한 용량을 선택해 주세요', description: '처방받은 용량 그대로 골라 주세요.' },
  3: { title: '어디에 맞으셨나요?', description: '그림의 부위를 눌러 선택해 주세요. 좌우는 내 몸 기준이에요.' },
  4: { title: '언제 맞으셨나요?', description: '투약한 날짜와 시간을 골라 주세요.' },
  5: { title: '이대로 기록할까요?', description: '내용을 확인해 주세요.' },
  6: { title: '확인했어요' },
}

/**
 * 첫 투약 등록 5단계 플로우.
 * draft·step은 부모가 들고 있어서 시트를 닫았다 열어도 이어서 할 수 있다.
 */
export function FirstDoseFlow({
  open,
  onOpenChange,
  draft,
  setDraft,
  step,
  setStep,
  onConfirmed,
  onFinished,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  draft: FirstDoseDraft
  setDraft: (d: FirstDoseDraft) => void
  step: number
  setStep: (s: number) => void
  /** 확인 시 호출 — 넘기면 목업 저장을 하고 완료 문구가 바뀐다 */
  /** 저장. Promise 면 끝날 때까지 기다리고, false 를 돌려주면 완료 화면으로 넘어가지 않는다 */
  onConfirmed?: (draft: FirstDoseDraft) => void | boolean | Promise<void | boolean>
  /** 완료 화면을 닫을 때 */
  onFinished?: () => void
}) {
  const [confirmClose, setConfirmClose] = useState(false)
  const [saving, setSaving] = useState(false)
  const patch = (p: Partial<FirstDoseDraft>) => setDraft({ ...draft, ...p })
  const done = step === 6
  const dtError = dateTimeError(draft)

  const requestClose = () => {
    if (done) {
      setDraft(EMPTY_DRAFT)
      setStep(1)
      onOpenChange(false)
      return onFinished?.()
    }
    if (isDirty(draft)) setConfirmClose(true)
    else onOpenChange(false)
  }

  /** 선택 즉시 다음 단계로 (선택 표시를 잠깐 보여준 뒤) */
  const selectAndNext = (p: Partial<FirstDoseDraft>, next: number) => {
    setDraft({ ...draft, ...p })
    window.setTimeout(() => setStep(next), 160)
  }

  const canNext = step === 2 ? draft.doseMg !== null && draft.doseMg > 0 : step === 3 ? !!draft.site : step === 4 ? !dtError : true

  const header = !done && (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => setStep(step - 1)}
        disabled={step === 1}
        className="-ml-2 inline-flex size-10 items-center justify-center rounded-full hover:bg-surface-muted disabled:invisible"
        aria-label="이전 단계"
      >
        <AppIcon icon={ChevronLeft} size="md" tone="text" />
      </button>
      <div
        className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-muted"
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={TOTAL}
        aria-valuenow={step}
        aria-label={`${TOTAL}단계 중 ${step}단계`}
      >
        <div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${(step / TOTAL) * 100}%` }} />
      </div>
      <span className="tabular w-10 text-right text-[13px] font-semibold text-text-muted">
        {step}/{TOTAL}
      </span>
    </div>
  )

  const footer = done ? (
    <Button size="lg" className="w-full" onClick={requestClose}>
      닫기
    </Button>
  ) : step === 1 ? null : step === 5 ? (
    <Button
      size="lg"
      className="w-full"
      disabled={saving}
      onClick={async () => {
        setSaving(true)
        try {
          const ok = await onConfirmed?.(draft)
          if (ok !== false) setStep(6)
        } finally {
          setSaving(false)
        }
      }}
    >
      {saving ? '저장 중…' : '확인'}
    </Button>
  ) : (
    <Button size="lg" className="w-full" disabled={!canNext} onClick={() => setStep(step + 1)}>
      다음
    </Button>
  )

  return (
    <>
      <BottomSheet
        open={open}
        onRequestClose={requestClose}
        title={TITLES[step].title}
        description={TITLES[step].description}
        header={header}
        footer={footer}
      >
        {step === 1 && (
          <StepMedication
            value={draft.medicationId}
            onSelect={(id) =>
              selectAndNext(
                id === draft.medicationId
                  ? {}
                  : { medicationId: id, doseMg: MEDICATIONS[id].doseOptionsMg?.[0] ?? null, site: null },
                2,
              )
            }
          />
        )}
        {step === 2 && draft.medicationId && (
          <StepDose medicationId={draft.medicationId} value={draft.doseMg} onPatch={patch} />
        )}
        {step === 3 && <StepSite draft={draft} onPatch={patch} />}
        {step === 4 && <StepDateTime draft={draft} onPatch={patch} error={dtError} />}
        {step === 5 && <Summary draft={draft} onEdit={setStep} />}
        {done && <Done saved={!!onConfirmed} />}
      </BottomSheet>

      <ConfirmDialog
        open={confirmClose}
        onOpenChange={setConfirmClose}
        title="기록을 잠시 멈출까요?"
        description="입력한 내용은 이 화면에 남아 있어요. 다시 열면 이어서 할 수 있어요."
        cancelLabel="계속 작성"
        confirmLabel="닫기"
        onConfirm={() => onOpenChange(false)}
      />
    </>
  )
}

function Summary({ draft, onEdit }: { draft: FirstDoseDraft; onEdit: (step: number) => void }) {
  const med = draft.medicationId ? MEDICATIONS[draft.medicationId] : null
  const rows = [
    { label: '약물', value: med?.name ?? '-', step: 1 },
    { label: '용량', value: draft.doseMg !== null ? `${draft.doseMg}mg` : '-', step: 2 },
    { label: '주사 부위', value: draft.site ? `${siteLabel(draft.site)} (내 몸 기준)` : '-', step: 3 },
    { label: '날짜', value: draft.date ? `${formatFullDate(draft.date)}${draft.dateApproximate ? ' · 대략' : ''}` : '-', step: 4 },
    { label: '시간', value: draft.timeUnknown ? '시간 모름' : draft.time || '-', step: 4 },
  ]
  return (
    <div className="space-y-3">
      <dl className="divide-y divide-border overflow-hidden rounded-2xl border border-border">
        {rows.map((r) => (
          <div key={r.label} className="flex min-h-14 items-center gap-3 px-4 py-2.5">
            <dt className="w-20 shrink-0 text-[13px] text-text-muted">{r.label}</dt>
            <dd className="tabular min-w-0 flex-1 text-[15px] font-semibold text-text">{r.value}</dd>
            <button
              type="button"
              onClick={() => onEdit(r.step)}
              className="h-9 shrink-0 rounded-lg px-2.5 text-[13px] font-medium text-text-muted hover:bg-surface-muted hover:text-text"
              aria-label={`${r.label} 수정`}
            >
              수정
            </button>
          </div>
        ))}
      </dl>
      <p className="text-[12px] leading-relaxed text-text-subtle">
        목업 단계라 서버에는 저장되지 않아요. 앱은 용량이나 주사 부위를 추천하지 않아요.
      </p>
    </div>
  )
}

function Done({ saved }: { saved: boolean }) {
  return (
    <div className="flex flex-col items-center py-6 text-center">
      <AppIcon icon={CircleCheck} size="lg" tone="success" bg="success" className="size-16 rounded-2xl [&>svg]:size-8" />
      <p className="mt-4 text-[17px] font-bold">{saved ? '투약 기록을 남겼어요' : '입력 내용을 확인했어요'}</p>
      <p className="mt-1 max-w-xs text-[14px] text-text-muted">
        {saved
          ? '목업이라 이 기기 화면에만 저장돼요. 홈에서 방금 남긴 기록을 확인할 수 있어요.'
          : '목업 화면이라 실제로 저장되지 않았어요. 저장 기능은 서버 연결 단계에서 붙일 예정이에요.'}
      </p>
    </div>
  )
}
