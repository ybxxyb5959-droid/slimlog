import { Minus, Plus } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { DateTimeSheet } from '@/components/common/DateTimePicker'
import { Button } from '@/components/ui/button'
import { toDateTimeLocalValue } from '@/lib/date'
import { cn } from '@/lib/utils'
import { validateBody, type BodyInput } from '@/services/body'

import { draftToBody, type BodyDraft } from './bodyDraft'

/**
 * 체중 기록 — '작은 방' 화면
 *  벽: 왼쪽 달력(누르면 날짜 시트) · 오른쪽 벽시계(누르면 시간 시트)
 *  바닥: 디지털 체중계. 화면(숫자)을 누르면 키패드로 바로 입력
 *  아래: −0.1 / +0.1 (길게 누르면 계속) · 드래그 눈금(0.1kg 단위로 딱딱 넘어감, 미끄러지지 않음)
 * 색은 앱 디자인 토큰만 쓴다.
 */
const WEEK = ['일', '월', '화', '수', '목', '금', '토']
const MIN = 20
const MAX = 300
const STEP_PX = 10 // 눈금 한 칸(0.1kg) = 10px

const clamp = (v: number) => Math.min(MAX, Math.max(MIN, v))
const fmt = (v: number) => (Math.round(v * 10) / 10).toFixed(1)

export function WeightScaleForm({
  draft,
  onChange,
  onSubmit,
  submitLabel,
  extraActions,
  initialWeight,
}: {
  draft: BodyDraft
  onChange: (d: BodyDraft) => void
  onSubmit: (input: BodyInput) => Promise<void>
  submitLabel: string
  extraActions?: React.ReactNode
  /** 비어 있을 때 ±·눈금의 시작값 (지난 체중) */
  initialWeight?: number
}) {
  const [error, setError] = useState<{ field: string; message: string } | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [sheet, setSheet] = useState<'date' | 'time' | null>(null)
  const set = (patch: Partial<BodyDraft>) => {
    setError(null)
    onChange({ ...draft, ...patch })
  }

  const num = Number(draft.weightKg.replace(',', '.'))
  const valid = draft.weightKg.trim() !== '' && Number.isFinite(num)
  const bump = (d: number) => set({ weightKg: fmt(clamp((valid ? num : (initialWeight ?? 60)) + d)) })

  const [datePart, timePart] = draft.measuredAt.split('T')
  const when = new Date(`${datePart}T${timePart || '00:00'}`)
  const nowLocal = toDateTimeLocalValue(new Date())

  return (
    <form
      noValidate
      className="space-y-5"
      onSubmit={async (e) => {
        e.preventDefault()
        if (submitting) return
        const input = draftToBody(draft)
        const err = validateBody(input)
        if (err) return setError(err)
        setSubmitting(true)
        try {
          await onSubmit(input)
        } finally {
          setSubmitting(false)
        }
      }}
    >
      {/* ── 방 ── */}
      <div className="overflow-hidden rounded-3xl border border-border bg-surface-muted">
        {/* 벽 */}
        <div className="flex items-center justify-around gap-3 px-5 pt-5 pb-3">
          <button
            type="button"
            onClick={() => setSheet('date')}
            aria-label={`측정 날짜: ${when.getMonth() + 1}월 ${when.getDate()}일 ${WEEK[when.getDay()]}요일, 바꾸기`}
            className="relative flex size-[120px] shrink-0 flex-col items-center justify-center rounded-2xl border border-border bg-surface pt-2 text-center shadow-[0_1px_2px_rgba(15,23,42,0.06)] transition-transform active:scale-[0.98]"
          >
            {/* 달력 고리 */}
            <span aria-hidden className="absolute -top-1.5 left-6 h-3.5 w-1.5 rounded-full bg-text-subtle" />
            <span aria-hidden className="absolute -top-1.5 right-6 h-3.5 w-1.5 rounded-full bg-text-subtle" />
            <span aria-hidden className="absolute inset-x-0 top-0 h-5 rounded-t-2xl bg-primary-soft" />
            <span className="relative block text-[12px] font-semibold text-primary">{when.getMonth() + 1}월</span>
            <span className="tabular block text-[34px] leading-none font-bold text-text">{when.getDate()}</span>
            <span className="mt-1 block text-[12px] text-text-muted">{WEEK[when.getDay()]}요일</span>
          </button>
          <button
            type="button"
            onClick={() => setSheet('time')}
            aria-label={`측정 시간: ${when.getHours() < 12 ? '오전' : '오후'} ${when.getHours() % 12 || 12}시 ${when.getMinutes()}분, 바꾸기`}
            className="flex size-[120px] shrink-0 items-center justify-center rounded-full transition-transform active:scale-[0.98]"
          >
            <WallClock h={when.getHours()} m={when.getMinutes()} />
          </button>
        </div>
        <p className="tabular -mt-1 pb-3 text-center text-[13px] font-medium text-text-muted">
          {when.getMonth() + 1}월 {when.getDate()}일 {WEEK[when.getDay()]}요일 · {when.getHours() < 12 ? '오전' : '오후'} {when.getHours() % 12 || 12}:{String(when.getMinutes()).padStart(2, '0')}
        </p>
        {error?.field === 'measuredAt' && (
          <p role="alert" className="px-4 pb-2 text-[13px] text-danger">
            {error.message}
          </p>
        )}

        {/* 바닥 + 체중계 */}
        <div className="relative border-t border-border bg-surface/60 px-6 pt-5 pb-0">
          <div className="relative mx-auto aspect-[1.05] w-full max-w-[260px]">
            <ScaleArt />
            {/* 체중계 화면 = 입력칸 (누르면 숫자 키패드) */}
            <div className="absolute inset-x-[22%] top-[9%] flex h-[17%] items-center justify-center rounded-xl bg-text px-2">
              <input
                id="body-weightKg"
                aria-label="체중"
                inputMode="decimal"
                enterKeyHint="done"
                value={draft.weightKg}
                placeholder="0.0"
                aria-invalid={error?.field === 'weightKg'}
                onFocus={(e) => e.currentTarget.select()}
                onChange={(e) => set({ weightKg: e.target.value.replace(/[^\d.,]/g, '').slice(0, 5) })}
                className="tabular w-full min-w-0 bg-transparent text-center text-[28px] leading-none font-bold text-surface outline-none placeholder:text-surface/40"
              />
              <span aria-hidden className="text-[13px] font-semibold text-surface/70">
                kg
              </span>
            </div>
          </div>
        </div>

        {/* 조절 */}
        <div className="space-y-3 border-t border-border bg-surface px-4 pt-4 pb-4">
          <div className="grid grid-cols-[1fr_1.4fr_1fr] items-center gap-2">
            <RepeatButton label="0.1kg 빼기" onStep={() => bump(-0.1)}>
              <Minus size={16} strokeWidth={2.2} aria-hidden />
              0.1
            </RepeatButton>
            <label htmlFor="body-weightKg" className={cn('tabular flex h-14 items-baseline justify-center gap-1 rounded-2xl border-2 bg-surface pt-2.5', error?.field === 'weightKg' ? 'border-danger' : 'border-primary')}>
              <span className="text-[28px] leading-none font-bold text-text">{valid ? fmt(num) : '—'}</span>
              <span className="text-[14px] font-semibold text-text-muted">kg</span>
            </label>
            <RepeatButton label="0.1kg 더하기" onStep={() => bump(0.1)}>
              <Plus size={16} strokeWidth={2.2} aria-hidden />
              0.1
            </RepeatButton>
          </div>
          <TickRuler value={valid ? num : (initialWeight ?? 60)} onChange={(v) => set({ weightKg: fmt(v) })} />
          {error?.field === 'weightKg' && (
            <p role="alert" className="text-[13px] text-danger">
              {error.message}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Button type="submit" size="lg" className="w-full" disabled={submitting}>
          {submitting ? '저장 중…' : submitLabel}
        </Button>
        {extraActions}
      </div>

      <DateTimeSheet
        open={sheet === 'date'}
        onClose={() => setSheet(null)}
        title="측정 날짜"
        mode="date"
        value={datePart}
        max={nowLocal.slice(0, 10)}
        onConfirm={(d) => set({ measuredAt: `${d}T${timePart || '00:00'}` })}
      />
      <DateTimeSheet
        open={sheet === 'time'}
        onClose={() => setSheet(null)}
        title="측정 시간"
        mode="time"
        value={timePart}
        onConfirm={(t) => set({ measuredAt: `${datePart}T${t}` })}
      />
    </form>
  )
}

/** 누르면 한 번, 길게 누르면 계속 (처음 0.4초 뒤부터 0.08초마다) */
function RepeatButton({ label, onStep, children }: { label: string; onStep: () => void; children: React.ReactNode }) {
  const timer = useRef<number | undefined>(undefined)
  const step = useRef(onStep)
  useEffect(() => {
    step.current = onStep
  })
  const stop = () => window.clearTimeout(timer.current)
  useEffect(() => stop, [])
  return (
    <button
      type="button"
      aria-label={label}
      onPointerDown={(e) => {
        e.preventDefault()
        step.current()
        const loop = (delay: number) => (timer.current = window.setTimeout(() => (step.current(), loop(80)), delay))
        loop(400)
      }}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), step.current())}
      className="tabular inline-flex h-12 items-center justify-center gap-0.5 rounded-full border border-border bg-surface text-[16px] font-semibold text-text select-none hover:bg-surface-muted active:bg-primary-soft"
    >
      {children}
    </button>
  )
}

/** 드래그 눈금 — 손가락을 옮긴 만큼 0.1kg 칸 단위로 딱딱 바뀜 (관성으로 미끄러지지 않음) */
function TickRuler({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const start = useRef<{ x: number; v: number } | null>(null)
  const tenths = Math.round(value * 10)
  const ticks = Array.from({ length: 41 }, (_, i) => tenths - 20 + i)
  return (
    <div>
      <div
        role="slider"
        tabIndex={0}
        aria-label="체중 드래그로 조절"
        aria-valuemin={MIN}
        aria-valuemax={MAX}
        aria-valuenow={Math.round(value * 10) / 10}
        aria-valuetext={`${fmt(value)}kg`}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId)
          start.current = { x: e.clientX, v: value }
        }}
        onPointerMove={(e) => {
          if (!start.current) return
          const steps = Math.round((start.current.x - e.clientX) / STEP_PX)
          const next = clamp(Math.round(start.current.v * 10 + steps) / 10)
          if (Math.abs(next - value) >= 0.05) onChange(next)
        }}
        onPointerUp={() => (start.current = null)}
        onPointerCancel={() => (start.current = null)}
        onKeyDown={(e) => {
          const d = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 0.1 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -0.1 : 0
          if (!d) return
          e.preventDefault()
          onChange(clamp(value + d))
        }}
        className="relative h-12 cursor-ew-resize touch-none overflow-hidden rounded-full border border-border bg-surface-muted outline-none select-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        <div className="absolute inset-y-0 left-1/2 flex items-center" style={{ transform: `translateX(${-(20 * STEP_PX + STEP_PX / 2)}px)` }} aria-hidden>
          {ticks.map((t) => (
            <span key={t} className="flex w-[10px] shrink-0 justify-center">
              <span className={cn('w-px rounded-full bg-text-subtle', t % 10 === 0 ? 'h-6 bg-text-muted' : t % 5 === 0 ? 'h-4' : 'h-2.5')} />
            </span>
          ))}
        </div>
        <span aria-hidden className="absolute top-1.5 bottom-1.5 left-1/2 w-1 -translate-x-1/2 rounded-full bg-primary" />
      </div>
      <p className="mt-1 text-center text-[12px] text-text-subtle">좌우로 밀어서 조절</p>
    </div>
  )
}

/** 벽시계 — 지금 고른 시각을 바늘로 */
function WallClock({ h, m }: { h: number; m: number }) {
  const ha = ((h % 12) + m / 60) * 30
  const ma = m * 6
  return (
    <svg viewBox="0 0 100 100" className="size-[120px]" aria-hidden>
      <circle cx="50" cy="50" r="46" className="fill-surface stroke-border" strokeWidth="6" />
      <circle cx="50" cy="50" r="46" fill="none" className="stroke-text-subtle" strokeWidth="1.5" />
      {Array.from({ length: 12 }, (_, i) => (
        <line key={i} x1="50" y1={i % 3 === 0 ? 10 : 12} x2="50" y2="17" className="stroke-text-muted" strokeWidth={i % 3 === 0 ? 3 : 1.6} strokeLinecap="round" transform={`rotate(${i * 30} 50 50)`} />
      ))}
      <line x1="50" y1="50" x2="50" y2="29" className="stroke-text" strokeWidth="4" strokeLinecap="round" transform={`rotate(${ha} 50 50)`} />
      <line x1="50" y1="50" x2="50" y2="18" className="stroke-primary" strokeWidth="2.5" strokeLinecap="round" transform={`rotate(${ma} 50 50)`} />
      <circle cx="50" cy="50" r="3.5" className="fill-text" />
    </svg>
  )
}

/** 체중계 (위에서 내려다본 모습) */
function ScaleArt() {
  return (
    <svg viewBox="0 0 260 250" className="absolute inset-0 h-full w-full" aria-hidden>
      {/* 체중계 판 */}
      <rect x="18" y="8" width="224" height="236" rx="44" className="fill-surface stroke-border" strokeWidth="4" />
      <rect x="30" y="20" width="200" height="212" rx="34" fill="none" className="stroke-border" strokeWidth="2" />
      {/* 발판 (금속 패드) */}
      <rect x="56" y="96" width="62" height="118" rx="26" className="fill-surface-muted stroke-border" strokeWidth="2" />
      <rect x="142" y="96" width="62" height="118" rx="26" className="fill-surface-muted stroke-border" strokeWidth="2" />
    </svg>
  )
}
