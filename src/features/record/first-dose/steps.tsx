import { CalendarDays, Check, ExternalLink, Info, Lightbulb } from 'lucide-react'
import { useEffect, useState } from 'react'

import { AppIcon } from '@/components/common/AppIcon'
import { TimeWheel } from '@/components/common/DateTimePicker'
import { Calendar } from '@/components/common/Calendar'
import { SwipeDosePicker } from '@/components/common/SwipeDosePicker'
import { BodyMap } from '@/components/illustrations/BodyMap'
import { MED_COLOR, MedPenIllustration } from '@/components/illustrations/MedPenIllustration'
import { Input } from '@/components/ui/input'
import { AREA_LABEL, MEDICATION_LIST, MEDICATIONS, SITE_AREA, siteLabel } from '@/fixtures/medications.mock'
import { addDays, formatFullDate, startOfDay, toDateTimeLocalValue } from '@/lib/date'
import { cn } from '@/lib/utils'
import { useDoses } from '@/services/doses'
import type { ApprovalSource, BodyArea, InjectionSite, MedicationId } from '@/types/domain'

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
const AREA_DOT: Record<BodyArea, string> = { abdomen: 'bg-primary', thigh: 'bg-icon', upper_arm: 'bg-review' }
const AREA_SITES: Record<BodyArea, [InjectionSite, InjectionSite]> = {
  abdomen: ['abdomen_right', 'abdomen_left'],
  thigh: ['thigh_right', 'thigh_left'],
  upper_arm: ['arm_right', 'arm_left'],
}
const sideOf = (s: InjectionSite) => (s.endsWith('_left') ? 'left' : s.endsWith('_right') ? 'right' : null)

/**
 * STEP 3 주사 부위 — 왼쪽: 몸 그림(정면) / 오른쪽: 선택한 부위 + 최근 4주 기록 분포
 * 아래: 빠른 선택(부위 → 좌우) · 부위 선택 가이드. 앱은 특정 부위를 추천하지 않고 지난 기록만 보여 준다.
 */
export function StepSite({ draft, onPatch }: { draft: FirstDoseDraft; onPatch: Patch }) {
  const med = MEDICATIONS[draft.medicationId!]
  const areas = med.approval.sites?.areas ?? null
  const allowed = (a: BodyArea) => !areas || areas.includes(a)
  const doses = useDoses()
  const [since] = useState(() => Date.now() - 28 * 86_400_000)
  const recent = doses.filter((d) => new Date(d.administeredAt).getTime() >= since)
  const counts = (['abdomen', 'thigh', 'upper_arm'] as BodyArea[]).map((a) => ({ area: a, n: recent.filter((d) => SITE_AREA[d.site] === a).length }))
  const total = counts.reduce((x, c) => x + c.n, 0)
  const last = doses[0]
  const selArea = draft.site ? SITE_AREA[draft.site] : null
  const selSide = draft.site ? sideOf(draft.site) : null

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,148px)] items-start gap-3">
        <BodyMap value={draft.site} onChange={(site) => onPatch({ site })} allowedAreas={areas} siteLabel={siteLabel} />
        <div className="space-y-2.5">
          {/* 선택한 부위 */}
          <section aria-label="선택한 부위" aria-live="polite" className={cn('rounded-2xl p-3', draft.site ? 'bg-primary-soft' : 'bg-surface-muted')}>
            <p className="text-[12px] font-semibold text-primary">선택한 부위</p>
            {draft.site && selArea ? (
              <>
                <p className="mt-1 text-[16px] leading-tight font-bold text-text">{AREA_LABEL[selArea]}</p>
                {selSide && (
                  <div role="radiogroup" aria-label="좌우 (내 몸 기준)" className="mt-2 grid grid-cols-2 gap-1 rounded-lg bg-surface p-0.5">
                    {(['right', 'left'] as const).map((side) => (
                      <button
                        key={side}
                        type="button"
                        role="radio"
                        aria-checked={selSide === side}
                        onClick={() => onPatch({ site: AREA_SITES[selArea][side === 'right' ? 0 : 1] })}
                        className={cn('h-8 rounded-md text-[12px] font-medium', selSide === side ? 'bg-primary font-semibold text-primary-foreground' : 'text-text-muted')}
                      >
                        {side === 'right' ? '오른쪽' : '왼쪽'}
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <p className="mt-1 text-[13px] leading-snug text-text-subtle">그림이나 아래 버튼을 눌러 주세요</p>
            )}
          </section>
          {/* 최근 분포 */}
          <section aria-labelledby="site-dist" className="rounded-2xl bg-surface-muted p-3">
            <p id="site-dist" className="text-[12px] font-semibold text-text-muted">
              최근 4주 기록
            </p>
            {total === 0 ? (
              <p className="mt-1 text-[12px] text-text-subtle">아직 기록이 없어요</p>
            ) : (
              <>
                <DistRing counts={counts} />
                <ul className="mt-2 space-y-1">
                  {counts.map((c) => (
                    <li key={c.area} className="flex items-center gap-1.5 text-[12px]">
                      <span aria-hidden className={cn('size-2 rounded-full', AREA_DOT[c.area])} />
                      <span className="flex-1 text-text-muted">{AREA_LABEL[c.area]}</span>
                      <span className="tabular font-semibold text-text">{c.n}회</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {last && <p className="mt-2 border-t border-border pt-2 text-[11px] leading-snug text-text-muted">지난번: {siteLabel(last.site)}</p>}
          </section>
        </div>
      </div>

      {/* 빠른 선택 */}
      <div>
        <p className="mb-2 text-[13px] font-semibold text-text-muted">빠른 선택</p>
        <div className="grid grid-cols-3 gap-2">
          {(['abdomen', 'thigh', 'upper_arm'] as BodyArea[]).map((a) => {
            const on = selArea === a
            const ok = allowed(a)
            return (
              <button
                key={a}
                type="button"
                aria-pressed={on}
                disabled={!ok}
                // 좌우는 위 '선택한 부위'에서 바꿈 (처음엔 오른쪽)
                onClick={() => onPatch({ site: on && draft.site ? draft.site : AREA_SITES[a][0] })}
                className={cn(
                  'h-12 rounded-xl border text-[14px] font-medium transition-colors disabled:opacity-35',
                  on ? 'border-primary bg-primary-soft font-semibold text-primary' : 'border-border bg-surface hover:bg-surface-muted',
                )}
              >
                {AREA_LABEL[a]}
              </button>
            )
          })}
        </div>
      </div>

      {/* 부위 선택 가이드 */}
      <section aria-labelledby="site-guide" className="rounded-2xl bg-surface-muted px-4 py-3">
        <p id="site-guide" className="flex items-center gap-1.5 text-[14px] font-bold">
          <Lightbulb size={16} strokeWidth={2} aria-hidden className="text-review" /> 부위 선택 가이드
        </p>
        <ul className="mt-2 space-y-1.5 text-[13px] text-text-muted">
          <li className="flex gap-1.5">
            <Check size={16} strokeWidth={2.4} aria-hidden className="mt-0.5 shrink-0 text-primary" />
            같은 부위에 연속 사용을 하지 말아주세요.
          </li>
          <li className="flex gap-1.5">
            <Check size={16} strokeWidth={2.4} aria-hidden className="mt-0.5 shrink-0 text-primary" />
            자극이 있거나 멍이 든 부위는 피해주세요.
          </li>
        </ul>
      </section>

      <p className="text-[12px] leading-relaxed text-text-subtle">
        {med.name} 허가 주사 부위: <b className="text-text-muted">{areas ? areas.map((a) => AREA_LABEL[a]).join(' · ') : '확인 전'}</b> · 처방 때 안내받은 대로 선택해 주세요.
      </p>
      <SourceNote label="주사 부위" source={med.approval.sites?.source} />
    </div>
  )
}

/** 최근 분포 도넛 — 부위별 횟수 비율 */
function DistRing({ counts }: { counts: { area: BodyArea; n: number }[] }) {
  const total = counts.reduce((x, c) => x + c.n, 0)
  const R = 15
  const C = 2 * Math.PI * R
  const color: Record<BodyArea, string> = { abdomen: 'stroke-primary', thigh: 'stroke-icon', upper_arm: 'stroke-review' }
  const segs = counts.filter((c) => c.n > 0).map((c) => ({ area: c.area, len: (c.n / total) * C }))
  const offsets = segs.map((_, i) => segs.slice(0, i).reduce((x, s) => x + s.len, 0))
  return (
    <svg viewBox="0 0 40 40" className="mt-2 size-12" aria-hidden>
      <circle cx="20" cy="20" r={R} fill="none" className="stroke-border" strokeWidth="6" />
      {segs.map((sg, i) => (
        <circle key={sg.area} cx="20" cy="20" r={R} fill="none" className={color[sg.area]} strokeWidth="6" strokeDasharray={`${sg.len} ${C - sg.len}`} strokeDashoffset={-offsets[i]} transform="rotate(-90 20 20)" />
      ))}
    </svg>
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
