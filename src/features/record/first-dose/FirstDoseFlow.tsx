import { ChevronLeft, CircleCheck, X } from 'lucide-react'
import { useState } from 'react'

import { AppIcon } from '@/components/common/AppIcon'
import { BottomSheet } from '@/components/common/BottomSheet'
import { DateTimeField } from '@/components/common/DateTimePicker'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { MEDICATIONS, siteLabel } from '@/fixtures/medications.mock'
import { isLive } from '@/lib/supabase'
import { formatFullDate, toDateKey } from '@/lib/date'
import type { MedicationId } from '@/types/domain'

import { dateTimeError, EMPTY_DRAFT, isDirty, SERIES_INTERVAL_DAYS, weeklyDates, type FirstDoseDraft } from './firstDoseDraft'
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
 * 투약 등록 5단계 플로우 (첫 투약 · 투약 추가 공용).
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
  mode = 'single',
  previousMedId = null,
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
  /** series: '전부터 투약 중' — 4단계에서 처음 맞은 날을 고르면 오늘까지 7일 간격으로 채우고, 5단계에서 날짜를 고치거나 뺀다 */
  mode?: 'single' | 'series'
  /** 지난 투약의 약 — 다른 약을 고르면 '약을 바꾸셨나요?' 확인 */
  previousMedId?: MedicationId | null
}) {
  const [confirmClose, setConfirmClose] = useState(false)
  const [saving, setSaving] = useState(false)
  const [switchTo, setSwitchTo] = useState<MedicationId | null>(null)
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

  const series = mode === 'series'
  const seriesCount = new Set(draft.seriesDates ?? []).size
  const titles = series
    ? {
        ...TITLES,
        4: { title: '처음 맞은 날은 언제예요?', description: `그날부터 오늘까지 ${SERIES_INTERVAL_DAYS}일 간격으로 채워 드려요. 다음 단계에서 날짜를 고칠 수 있어요.` },
        5: { title: '이대로 기록할까요?', description: '실제와 다른 날짜는 고치거나 빼 주세요.' },
      }
    : TITLES
  /** 4→5: 처음 맞은 날이 바뀌었으면 7일 간격으로 새로 채운다 (같으면 사용자가 고친 목록 유지) */
  const goNext = () => {
    if (series && step === 4 && draft.date) {
      const first = toDateKey(draft.date)
      if (draft.seriesDates?.[0] !== first) return (setDraft({ ...draft, seriesDates: weeklyDates(draft.date) }), setStep(5))
    }
    setStep(step + 1)
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
      disabled={saving || (series && seriesCount === 0)}
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
      {saving ? '저장 중…' : series ? `${seriesCount}회 기록하기` : '확인'}
    </Button>
  ) : (
    <Button size="lg" className="w-full" disabled={!canNext} onClick={goNext}>
      다음
    </Button>
  )

  return (
    <>
      <BottomSheet
        open={open}
        onRequestClose={requestClose}
        title={titles[step].title}
        description={titles[step].description}
        header={header}
        footer={footer}
      >
        {step === 1 && previousMedId && (
          <p className="mb-3 rounded-xl bg-surface-muted px-3.5 py-2.5 text-[13px] break-keep text-text-muted">
            지난번엔 <b className="text-text">{MEDICATIONS[previousMedId].ingredient}({MEDICATIONS[previousMedId].name})</b>를 기록했어요. 약을 바꿨다면 새 약을 골라 주세요.
          </p>
        )}
        {step === 1 && (
          <StepMedication
            value={draft.medicationId}
            onSelect={(id) => {
              if (id === draft.medicationId) return selectAndNext({}, 2)
              // 지난 투약과 다른 약 → 바꾼 게 맞는지 먼저 확인
              if (previousMedId && id !== previousMedId) return setSwitchTo(id)
              selectAndNext({ medicationId: id, doseMg: MEDICATIONS[id].doseOptionsMg?.[0] ?? null, site: null }, 2)
            }}
          />
        )}
        {step === 2 && previousMedId && draft.medicationId === previousMedId && (
          <button type="button" onClick={() => setStep(1)} className="mb-3 h-9 rounded-lg px-2 text-[13px] font-medium text-primary hover:bg-primary-soft">
            약을 바꾸셨나요? 다른 약 고르기
          </button>
        )}
        {step === 2 && draft.medicationId && (
          <StepDose medicationId={draft.medicationId} value={draft.doseMg} onPatch={patch} />
        )}
        {step === 3 && <StepSite draft={draft} onPatch={patch} />}
        {step === 4 && <StepDateTime draft={draft} onPatch={patch} error={dtError} />}
        {step === 5 && <Summary draft={draft} onEdit={setStep} series={series} />}
        {step === 5 && series && <SeriesDates draft={draft} setDraft={setDraft} />}
        {done && <Done saved={!!onConfirmed} count={series ? seriesCount : undefined} />}
      </BottomSheet>

      <ConfirmDialog
        open={switchTo !== null}
        onOpenChange={(o) => !o && setSwitchTo(null)}
        title="약을 바꾸셨나요?"
        description={
          switchTo && previousMedId
            ? `${MEDICATIONS[previousMedId].ingredient}(${MEDICATIONS[previousMedId].name}) → ${MEDICATIONS[switchTo].ingredient}(${MEDICATIONS[switchTo].name})로 기록해요. 사용 중인 약도 함께 바뀌고, 지난 기록은 그대로 남아요. 용량은 새 약의 허가 용량에서 골라요.`
            : undefined
        }
        cancelLabel="다시 고를게요"
        confirmLabel="네, 바꿨어요"
        onConfirm={() => {
          if (!switchTo) return
          // 용량은 새 약의 첫 단계부터 (추천이 아니라 선택지가 바뀌는 것)
          selectAndNext({ medicationId: switchTo, doseMg: MEDICATIONS[switchTo].doseOptionsMg?.[0] ?? null, site: null }, 2)
          setSwitchTo(null)
        }}
      />
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

function Summary({ draft, onEdit, series }: { draft: FirstDoseDraft; onEdit: (step: number) => void; series?: boolean }) {
  const med = draft.medicationId ? MEDICATIONS[draft.medicationId] : null
  const rows = [
    { label: '약물', value: med?.name ?? '-', step: 1 },
    { label: '용량', value: draft.doseMg !== null ? `${draft.doseMg}mg` : '-', step: 2 },
    { label: '주사 부위', value: draft.site ? `${siteLabel(draft.site)} (내 몸 기준)` : '-', step: 3 },
    { label: series ? '처음 맞은 날' : '날짜', value: draft.date ? `${formatFullDate(draft.date)}${draft.dateApproximate ? ' · 대략' : ''}` : '-', step: 4 },
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
        {series ? '모든 회차에 같은 약·용량·부위·시간으로 저장돼요. 달랐던 날은 저장 후 투약 목록에서 고칠 수 있어요. ' : ''}앱은 용량이나 주사 부위를 추천하지 않아요.
      </p>
    </div>
  )
}

/** '전부터 투약 중' 회차 목록 — 날짜 고치기·빼기 */
function SeriesDates({ draft, setDraft }: { draft: FirstDoseDraft; setDraft: (d: FirstDoseDraft) => void }) {
  const dates = draft.seriesDates ?? []
  const today = toDateKey(new Date())
  const setAt = (i: number, v: string) => {
    const next = dates.map((d, j) => (j === i ? v : d))
    // 첫 회차를 고치면 '처음 맞은 날'도 같이 (4단계로 돌아가도 목록이 다시 만들어지지 않게)
    const [y, m, day] = (i === 0 ? v : (draft.date ? toDateKey(draft.date) : v)).split('-').map(Number)
    setDraft({ ...draft, seriesDates: next, date: new Date(y, m - 1, day) })
  }
  const removeAt = (i: number) => {
    const next = dates.filter((_, j) => j !== i)
    const first = next[0]
    setDraft({ ...draft, seriesDates: next, ...(i === 0 && first ? { date: new Date(Number(first.slice(0, 4)), Number(first.slice(5, 7)) - 1, Number(first.slice(8, 10))) } : {}) })
  }
  const dup = (v: string) => dates.filter((d) => d === v).length > 1
  return (
    <section aria-labelledby="series-title" className="mt-4 space-y-2">
      <div className="flex items-baseline justify-between">
        <h3 id="series-title" className="text-[15px] font-bold">
          투약 날짜 <span className="tabular text-primary">{new Set(dates).size}회</span>
        </h3>
        <span className="text-[12px] text-text-subtle">{SERIES_INTERVAL_DAYS}일 간격으로 채웠어요</span>
      </div>
      <ol className="space-y-2">
        {dates.map((d, i) => (
          <li key={i} className="flex items-center gap-2">
            <span className="tabular w-11 shrink-0 text-[13px] font-semibold text-text-muted">{i + 1}회</span>
            <DateTimeField label={`${i + 1}회차 날짜`} mode="date" value={d} max={today} invalid={dup(d)} onChange={(v) => setAt(i, v)} className="h-11" />
            <button
              type="button"
              onClick={() => removeAt(i)}
              aria-label={`${i + 1}회차 빼기`}
              className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl text-text-muted hover:bg-surface-muted"
            >
              <X size={18} aria-hidden />
            </button>
          </li>
        ))}
      </ol>
      {dates.some(dup) && <p className="text-[12px] text-review">같은 날짜가 있어요. 저장할 때 하나로 합쳐요.</p>}
      {dates.length === 0 && <p className="text-[13px] text-text-muted">남은 날짜가 없어요. 4단계에서 처음 맞은 날을 다시 골라 주세요.</p>}
    </section>
  )
}

function Done({ saved, count }: { saved: boolean; count?: number }) {
  return (
    <div className="flex flex-col items-center py-6 text-center">
      <AppIcon icon={CircleCheck} size="lg" tone="success" bg="success" className="size-16 rounded-2xl [&>svg]:size-8" />
      <p className="mt-4 text-[17px] font-bold">{saved ? (count ? `투약 기록 ${count}회를 남겼어요` : '투약 기록을 남겼어요') : '입력 내용을 확인했어요'}</p>
      <p className="mt-1 max-w-xs text-[14px] text-text-muted">
        {saved
          ? isLive
            ? '홈과 투약 목록, 참고 곡선에서 방금 남긴 기록을 확인할 수 있어요.'
            : '목업이라 이 기기 화면에만 저장돼요. 홈에서 방금 남긴 기록을 확인할 수 있어요.'
          : '목업 화면이라 실제로 저장되지 않았어요. 저장 기능은 서버 연결 단계에서 붙일 예정이에요.'}
      </p>
    </div>
  )
}
