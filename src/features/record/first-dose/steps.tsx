import { CalendarDays, Check, ExternalLink, Info } from 'lucide-react'
import { useEffect } from 'react'

import { AppIcon } from '@/components/common/AppIcon'
import { TimeWheel } from '@/components/common/DateTimePicker'
import { Calendar } from '@/components/common/Calendar'
import { SwipeDosePicker } from '@/components/common/SwipeDosePicker'
import { BodyMap } from '@/components/illustrations/BodyMap'
import { MED_COLOR, MedPenIllustration } from '@/components/illustrations/MedPenIllustration'
import { Input } from '@/components/ui/input'
import { AREA_LABEL, MEDICATION_LIST, MEDICATIONS, siteLabel } from '@/fixtures/medications.mock'
import { addDays, formatFullDate, startOfDay, toDateTimeLocalValue } from '@/lib/date'
import { cn } from '@/lib/utils'
import type { ApprovalSource, MedicationId } from '@/types/domain'

import type { FirstDoseDraft } from './firstDoseDraft'

type Patch = (p: Partial<FirstDoseDraft>) => void

/* ---------- 출처 표시 ---------- */
export function SourceNote({ label, source }: { label: string; source: ApprovalSource | null | undefined }) {
  if (!source)
    return (
      <p className="flex gap-1.5 text-[12px] leading-relaxed text-review">
        <AppIcon icon={Info} size="sm" tone="review" className="mt-px size-4" />
        {label} 허가 정보를 확인하지 못했어요.
      </p>
    )
  return (
    <p className="flex gap-1.5 text-[12px] leading-relaxed text-text-subtle">
      <AppIcon icon={Info} size="sm" tone="muted" className="mt-px size-4" />
      <span className="min-w-0">
        {label} 출처:{' '}
        <a href={source.url} target="_blank" rel="noreferrer" className="underline decoration-dotted underline-offset-2 hover:text-text-muted">
          {source.title}
          <ExternalLink size={11} strokeWidth={1.75} className="ml-0.5 inline align-[-1px]" aria-hidden />
        </a>{' '}
        · {source.checkedAt} 확인{source.status === 'secondary' && ' · 허가사항 원문 대조 필요'}
      </span>
    </p>
  )
}

/* ---------- STEP 1 약물 ---------- */
export function StepMedication({ value, onSelect }: { value: MedicationId | null; onSelect: (id: MedicationId) => void }) {
  return (
    <div role="radiogroup" aria-label="약 선택" className="grid gap-3">
      {MEDICATION_LIST.map((m) => {
        const selected = value === m.id
        return (
          <button
            key={m.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onSelect(m.id)}
            style={selected ? { borderColor: MED_COLOR[m.id], background: `color-mix(in srgb, ${MED_COLOR[m.id]} 9%, var(--color-surface, #fff))` } : undefined}
            className={cn(
              'flex min-h-[108px] items-center gap-3 rounded-2xl border-2 py-3 pr-2 pl-4 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
              !selected && 'border-border bg-surface hover:bg-surface-muted/60',
            )}
          >
            <span
              aria-hidden
              className={cn('inline-flex size-7 shrink-0 items-center justify-center rounded-full text-white', !selected && 'bg-border')}
              style={selected ? { background: MED_COLOR[m.id] } : undefined}
            >
              <Check size={16} strokeWidth={3} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[18px] leading-tight font-bold" style={selected ? { color: MED_COLOR[m.id] } : undefined}>
                {m.ingredient}
              </span>
              <span className="mt-0.5 block text-[15px] font-semibold text-text-muted">{m.name}</span>
              {m.doseOptionsMg && (
                <span className="tabular mt-1 block text-[12px] text-text-subtle">
                  허가 용량 {m.doseOptionsMg[0]}~{m.doseOptionsMg.at(-1)}mg · {m.doseOptionsMg.length}단계
                </span>
              )}
            </span>
            <MedPenIllustration med={m.id} selected={selected} className="h-[76px] w-[92px] shrink-0" />
          </button>
        )
      })}
    </div>
  )
}

/* ---------- STEP 2 용량 (단일 값 스와이프 선택기) ---------- */
export function StepDose({ medicationId, value, onPatch }: { medicationId: MedicationId; value: number | null; onPatch: Patch }) {
  const med = MEDICATIONS[medicationId]
  const options = med.doseOptionsMg

  if (!options)
    return (
      <div className="space-y-3">
        <SourceNote label="허가 용량" source={null} />
        <p className="text-[14px] text-text-muted">처방받은 용량을 직접 입력해 주세요.</p>
        <div className="relative">
          <Input
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            aria-label="용량 (mg)"
            value={value ?? ''}
            onChange={(e) => onPatch({ doseMg: e.target.value === '' ? null : Number(e.target.value) })}
            className="pr-12"
          />
          <span className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-text-muted">mg</span>
        </div>
      </div>
    )

  return (
    <div className="space-y-4">
      <p className="text-center text-[13px] text-text-muted">좌우로 밀거나 슬라이더를 움직여 선택하세요</p>
      <SwipeDosePicker
        label={`${med.name} 용량`}
        options={options}
        value={value ?? options[0]}
        onChange={(mg) => onPatch({ doseMg: mg })}
      />
      <p className="rounded-xl bg-surface-muted px-4 py-3 text-[13px] text-text-muted">
        처방받은 용량으로 맞춰 주세요. 앱은 용량을 추천하거나 판단하지 않아요.
      </p>
      <SourceNote label="허가 용량" source={med.approval.doses} />
    </div>
  )
}

/* ---------- STEP 3 주사 부위 ---------- */
export function StepSite({ draft, onPatch }: { draft: FirstDoseDraft; onPatch: Patch }) {
  const med = MEDICATIONS[draft.medicationId!]
  const areas = med.approval.sites?.areas ?? null
  return (
    <div className="space-y-4">
      <BodyMap value={draft.site} onChange={(site) => onPatch({ site })} allowedAreas={areas} siteLabel={siteLabel} />
      <div
        className={cn(
          'flex min-h-14 items-center justify-between gap-3 rounded-2xl px-4 py-3',
          draft.site ? 'bg-primary-soft' : 'bg-surface-muted',
        )}
        aria-live="polite"
      >
        <span className="text-[13px] text-text-muted">선택한 부위</span>
        <span className={cn('text-[16px] font-bold', draft.site ? 'text-primary' : 'text-text-subtle')}>
          {draft.site ? `${siteLabel(draft.site)} (내 몸 기준)` : '그림에서 눌러 주세요'}
        </span>
      </div>
      <p className="text-[13px] leading-relaxed text-text-muted">
        {med.name} 허가 주사 부위: <b className="text-text">{areas ? areas.map((a) => AREA_LABEL[a]).join(' · ') : '확인 전'}</b>
        <br />
        기록을 위한 화면이에요. 주사 위치는 처방 때 안내받은 대로 선택해 주세요.
      </p>
      <SourceNote label="주사 부위" source={med.approval.sites?.source} />
    </div>
  )
}

/* ---------- STEP 4 날짜·시간 ---------- */
export function StepDateTime({ draft, onPatch, error }: { draft: FirstDoseDraft; onPatch: Patch; error: string | null }) {
  const today = startOfDay(new Date())
  const yesterday = addDays(today, -1)
  const quick = [
    { label: '오늘', date: today },
    { label: '어제', date: yesterday },
  ]
  const nowTime = toDateTimeLocalValue(new Date()).slice(11)
  // 시간이 비어 있으면 지금 시각을 먼저 골라 둔다 (휠에 보이는 값과 저장 값이 같게)
  useEffect(() => {
    if (!draft.time && !draft.timeUnknown) onPatch({ time: nowTime })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {quick.map((q) => {
          const active = !!draft.date && startOfDay(draft.date).getTime() === q.date.getTime()
          return (
            <button
              key={q.label}
              type="button"
              aria-pressed={active}
              onClick={() => onPatch({ date: q.date })}
              className={cn(
                'h-11 flex-1 rounded-xl border text-[14px] font-medium',
                active ? 'border-primary bg-primary-soft font-semibold text-primary' : 'border-border bg-surface hover:bg-surface-muted',
              )}
            >
              {q.label}
            </button>
          )
        })}
      </div>

      <Calendar value={draft.date} onChange={(date) => onPatch({ date })} maxDate={today} />

      <label className="flex min-h-11 cursor-pointer items-center gap-3 text-[14px]">
        <input
          id="dateApproximate"
          type="checkbox"
          checked={draft.dateApproximate}
          onChange={(e) => onPatch({ dateApproximate: e.target.checked })}
          className="size-5 accent-[var(--primary)]"
        />
        <span>
          날짜가 정확하지 않아요
          <span className="block text-[12px] text-text-muted">가장 가까운 날짜를 고르면 ‘대략’으로 표시돼요</span>
        </span>
      </label>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <p id="doseTimeLabel" className="text-[13px] font-medium text-text-muted">
            시간
          </p>
          <button
            type="button"
            disabled={draft.timeUnknown}
            onClick={() => onPatch({ time: nowTime, date: draft.date ?? today })}
            className="h-9 shrink-0 rounded-lg px-3 text-[13px] font-medium text-primary hover:bg-primary-soft disabled:opacity-40"
          >
            지금
          </button>
        </div>
        {!draft.timeUnknown && <TimeWheel value={draft.time || nowTime} onChange={(time) => onPatch({ time })} />}
        <label className="mt-2 flex min-h-11 cursor-pointer items-center gap-3 text-[14px]">
          <input
            id="timeUnknown"
            type="checkbox"
            checked={draft.timeUnknown}
            onChange={(e) => onPatch({ timeUnknown: e.target.checked })}
            className="size-5 accent-[var(--primary)]"
          />
          <span>
            시간이 기억나지 않아요
            <span className="block text-[12px] text-text-muted">‘시간 모름’으로 기록되고, 곡선에서는 그날 정오 기준으로 그려져요</span>
          </span>
        </label>
      </div>

      {draft.date && (
        <p className="flex items-center gap-2 text-[13px] text-text-muted">
          <AppIcon icon={CalendarDays} size="sm" className="size-[18px]" />
          {formatFullDate(draft.date)}
          {draft.dateApproximate && ' (대략)'}
        </p>
      )}
      {error && draft.date && (
        <p role="alert" className="text-[13px] font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  )
}
