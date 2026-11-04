import { Activity, Angry, Check, ChevronRight, Frown, Laugh, Meh, Smile } from 'lucide-react'
import { Slider } from 'radix-ui'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'

import { AppIcon } from '@/components/common/AppIcon'
import { ChipGroup } from '@/components/common/ChipGroup'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { MockBadge } from '@/components/common/MockBadge'
import { PageHeader } from '@/components/common/PageHeader'
import { EmptyState } from '@/components/common/StateViews'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { SYMPTOM_LABEL } from '@/fixtures/records.mock'
import { formatShortDateWithDay, formatTime, localInputToIso, toDateKey, toDateTimeLocalValue } from '@/lib/date'
import { dbErrorMessage, isLive } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { savedNote } from '@/services/doses'
import { addSymptom, editSymptom, removeSymptom, saveDaily, useDaily, useSymptoms, validateSymptom, type SymptomInput } from '@/services/symptoms'
import { useRecordsStore } from '@/stores/recordsStore'
import type { Symptom, SymptomType } from '@/types/domain'

const SCALE = [1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: String(n) }))
const TYPES = (Object.keys(SYMPTOM_LABEL) as SymptomType[]).map((t) => ({ value: t, label: SYMPTOM_LABEL[t] }))
const SEVERITY_TEXT = ['', '약함', '조금', '보통', '꽤 심함', '심함']

const CONDITIONS = [
  { v: 1, label: '매우 나쁨', icon: Angry },
  { v: 2, label: '나쁨', icon: Frown },
  { v: 3, label: '보통', icon: Meh },
  { v: 4, label: '좋음', icon: Smile },
  { v: 5, label: '매우 좋음', icon: Laugh },
]
const APPETITE = ['거의 없음', '적음', '보통', '많음', '매우 많음']

/** 오늘 컨디션 — 날짜당 한 번, 다시 저장하면 고친다 */
function DailyCard() {
  const today = toDateKey(new Date())
  const saved = useDaily(today)
  const [condition, setCondition] = useState<number | null>(saved?.condition ?? null)
  const [appetite, setAppetite] = useState<number | null>(saved?.appetite ?? null)
  const [sleep, setSleep] = useState<number | null>(saved?.sleepH ?? null)
  const [busy, setBusy] = useState(false)

  return (
    <Card className="space-y-6">
      <section aria-labelledby="cond-title">
        <h2 id="cond-title" className="text-[18px] font-bold">
          오늘 몸 상태는 어때요?
        </h2>
        <p className="mt-0.5 text-[13px] text-text-muted">하루 한 번, 가볍게 체크해 보세요.</p>
        <div role="radiogroup" aria-label="오늘 몸 상태" className="mt-3 grid grid-cols-5 gap-1.5">
          {CONDITIONS.map((c) => {
            const on = condition === c.v
            return (
              <button
                key={c.v}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setCondition(c.v)}
                className={cn(
                  'flex min-h-[84px] flex-col items-center justify-center gap-1.5 rounded-2xl border px-1 text-[12px] font-medium transition-colors',
                  on ? 'border-primary bg-primary-soft text-primary' : 'border-border bg-surface text-text-muted hover:bg-surface-muted',
                )}
              >
                <c.icon size={28} strokeWidth={1.75} aria-hidden className={on ? 'text-primary' : 'text-icon'} />
                <span className="break-keep">{c.label}</span>
              </button>
            )
          })}
        </div>
      </section>

      <section aria-labelledby="appetite-title" className="border-t border-border pt-5">
        <h2 id="appetite-title" className="text-[18px] font-bold">
          식욕은 어떠세요?
        </h2>
        <div role="radiogroup" aria-label="식욕" className="mt-2">
          {APPETITE.map((label, i) => {
            const on = appetite === i + 1
            return (
              <button key={label} type="button" role="radio" aria-checked={on} onClick={() => setAppetite(i + 1)} className="flex min-h-11 w-full items-center gap-3 text-left text-[15px]">
                <span aria-hidden className={cn('inline-flex size-5 items-center justify-center rounded-full border-2', on ? 'border-primary' : 'border-border')}>
                  {on && <span className="size-2.5 rounded-full bg-primary" />}
                </span>
                {label}
              </button>
            )
          })}
        </div>
      </section>

      <section aria-labelledby="sleep-title" className="border-t border-border pt-5">
        <div className="flex items-baseline justify-between">
          <h2 id="sleep-title" className="text-[18px] font-bold">
            어젯밤 수면
          </h2>
          <p className="tabular text-[24px] font-bold" aria-live="polite">
            {sleep === null ? <span className="text-[14px] font-medium text-text-subtle">선택 안 함</span> : `${sleep}시간`}
          </p>
        </div>
        <Slider.Root
          className="relative mt-3 flex h-8 w-full touch-none items-center select-none"
          min={0}
          max={12}
          step={0.5}
          value={[sleep ?? 7]}
          onValueChange={([v]) => setSleep(v)}
          aria-label="수면 시간"
        >
          <Slider.Track className="relative h-2 grow overflow-hidden rounded-full bg-surface-muted">
            <Slider.Range className={cn('absolute h-full rounded-full', sleep === null ? 'bg-transparent' : 'bg-icon')} />
          </Slider.Track>
          <Slider.Thumb aria-label="수면 시간" aria-valuetext={sleep === null ? '선택 안 함' : `${sleep}시간`} className="block size-7 rounded-full border-[3px] border-icon bg-surface shadow-[0_1px_4px_rgba(15,23,42,0.2)] outline-none focus-visible:ring-4 focus-visible:ring-icon/25" />
        </Slider.Root>
        <div className="mt-1 flex justify-between text-[12px] text-text-subtle" aria-hidden>
          <span>0</span>
          <span>6</span>
          <span>12시간</span>
        </div>
      </section>

      <Button
        size="lg"
        className="w-full rounded-full"
        disabled={busy || (condition === null && appetite === null && sleep === null)}
        onClick={async () => {
          setBusy(true)
          try {
            await saveDaily({ date: today, condition, appetite, sleepH: sleep })
            toast.success('오늘 컨디션을 저장했어요', { description: savedNote() })
          } catch (e) {
            toast.error('저장하지 못했어요', { description: dbErrorMessage(e) })
          } finally {
            setBusy(false)
          }
        }}
      >
        {busy ? '저장 중…' : saved ? '컨디션 수정' : '컨디션 저장'}
      </Button>
    </Card>
  )
}

const SEVERITY_SEG = [
  { v: 1, label: '약함' },
  { v: 3, label: '보통' },
  { v: 5, label: '심함' },
]
const WHEN = [
  { v: 'today', label: '오늘' },
  { v: 'yesterday', label: '어제' },
  { v: 'custom', label: '직접 선택' },
] as const
const DURATION = [
  { v: 0.5, label: '1시간 미만' },
  { v: 2, label: '1~3시간' },
  { v: 4, label: '3시간 이상' },
  { v: null, label: '지속 중' },
]

interface QuickEntry {
  severity: number
  when: (typeof WHEN)[number]['v']
  at: string // datetime-local (직접 선택)
  duration: number | null | undefined // undefined = 선택 안 함
}

function Radio({ name, options }: { name: string; options: { key: string; label: string; on: boolean; pick: () => void }[] }) {
  return (
    <div role="radiogroup" aria-label={name}>
      {options.map((o) => (
        <button key={o.key} type="button" role="radio" aria-checked={o.on} onClick={o.pick} className="flex min-h-10 w-full items-center gap-3 text-left text-[15px]">
          <span aria-hidden className={cn('inline-flex size-5 items-center justify-center rounded-full border-2', o.on ? 'border-primary' : 'border-border')}>
            {o.on && <span className="size-2.5 rounded-full bg-primary" />}
          </span>
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** 증상 빠른 기록 — 여러 개 고르고, 고른 증상마다 강도·시작·지속을 정한다 */
function QuickSymptomCard() {
  const [picked, setPicked] = useState<Record<string, QuickEntry>>({})
  const [memo, setMemo] = useState('')
  const [busy, setBusy] = useState(false)
  const order = TYPES.filter((t) => picked[t.value])
  const set = (type: string, patch: Partial<QuickEntry>) => setPicked((p) => ({ ...p, [type]: { ...p[type], ...patch } }))
  const toggle = (type: string) =>
    setPicked((p) => {
      const next = { ...p }
      if (next[type]) delete next[type]
      else next[type] = { severity: 3, when: 'today', at: toDateTimeLocalValue(new Date()), duration: undefined }
      return next
    })
  const startOf = (e: QuickEntry) => {
    if (e.when === 'custom') return localInputToIso(e.at)
    const d = new Date()
    if (e.when === 'yesterday') d.setDate(d.getDate() - 1)
    return d.toISOString()
  }

  const save = async () => {
    const inputs: SymptomInput[] = order.map((t) => {
      const e = picked[t.value]
      return { type: t.value, severity: e.severity, recordedAt: startOf(e), durationH: e.duration ?? null, memo: [e.duration === null ? '지속 중' : '', memo.trim()].filter(Boolean).join(' · ') || null }
    })
    const err = inputs.map(validateSymptom).find(Boolean)
    if (err) return void toast.error(err)
    setBusy(true)
    try {
      for (const i of inputs) await addSymptom(i)
      toast.success(`증상 ${inputs.length}개를 기록했어요`, { description: savedNote() })
      setPicked({})
      setMemo('')
    } catch (e) {
      toast.error('저장하지 못했어요', { description: dbErrorMessage(e) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-[18px] font-bold">증상 기록</h2>
        <Badge>여러 개 선택</Badge>
      </div>
      <p className="-mt-2 text-[13px] text-text-muted">오늘 불편했던 증상이 있나요?</p>
      <div role="group" aria-label="증상 선택" className="grid grid-cols-3 gap-2">
        {TYPES.map((t) => {
          const on = !!picked[t.value]
          return (
            <button
              key={t.value}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(t.value)}
              className={cn('flex min-h-12 flex-col items-center justify-center rounded-2xl border px-1 text-[14px] font-semibold transition-colors', on ? 'border-primary bg-primary-soft text-primary' : 'border-border bg-surface hover:bg-surface-muted')}
            >
              {t.label}
              {on && <Check size={14} strokeWidth={2.5} aria-hidden />}
            </button>
          )
        })}
      </div>

      {order.map((t) => {
        const e = picked[t.value]
        return (
          <section key={t.value} aria-label={`${t.label} 자세히`} className="space-y-3 border-t border-border pt-4">
            <div className="flex items-baseline justify-between">
              <h3 className="text-[16px] font-bold">{t.label}</h3>
              <span className="text-[12px] text-text-subtle">선택한 증상</span>
            </div>
            <div>
              <p className="mb-1.5 text-[13px] text-text-muted">증상 강도</p>
              <div role="radiogroup" aria-label={`${t.label} 강도`} className="grid grid-cols-3 gap-1 rounded-full bg-surface-muted p-1">
                {SEVERITY_SEG.map((sv) => (
                  <button key={sv.v} type="button" role="radio" aria-checked={e.severity === sv.v} onClick={() => set(t.value, { severity: sv.v })} className={cn('h-9 rounded-full text-[14px] font-medium', e.severity === sv.v ? 'bg-surface font-semibold text-text shadow-[0_1px_2px_rgba(15,23,42,0.08)]' : 'text-text-muted')}>
                    {sv.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[13px] text-text-muted">언제 시작됐나요?</p>
              <Radio name={`${t.label} 시작`} options={WHEN.map((w) => ({ key: w.v, label: w.label, on: e.when === w.v, pick: () => set(t.value, { when: w.v }) }))} />
              {e.when === 'custom' && (
                <Input type="datetime-local" aria-label={`${t.label} 시작 시각`} value={e.at} max={toDateTimeLocalValue(new Date())} onChange={(ev) => set(t.value, { at: ev.target.value })} className="mt-1" />
              )}
            </div>
            <div>
              <p className="text-[13px] text-text-muted">얼마나 지속됐나요?</p>
              <Radio name={`${t.label} 지속`} options={DURATION.map((d) => ({ key: d.label, label: d.label, on: e.duration === d.v, pick: () => set(t.value, { duration: d.v }) }))} />
            </div>
          </section>
        )
      })}

      {order.length > 0 && (
        <>
          <Textarea aria-label="추가 메모" placeholder="추가로 남길 내용 (선택)" maxLength={150} value={memo} onChange={(e) => setMemo(e.target.value)} className="min-h-20" />
          <Button size="lg" className="w-full rounded-full" disabled={busy} onClick={save}>
            {busy ? '저장 중…' : order.length > 1 ? `증상 ${order.length}개 저장` : '증상 저장'}
          </Button>
        </>
      )}
    </Card>
  )
}

interface SymptomDraft {
  type: SymptomType | null
  severity: string | null
  recordedAt: string
  durationH: string
  memo: string
}
const emptyDraft = (): SymptomDraft => ({ type: null, severity: null, recordedAt: toDateTimeLocalValue(new Date()), durationH: '', memo: '' })
const toInput = (d: SymptomDraft): Partial<SymptomInput> => ({
  type: d.type ?? undefined,
  severity: d.severity ? Number(d.severity) : undefined,
  recordedAt: d.recordedAt ? localInputToIso(d.recordedAt) : undefined,
  durationH: d.durationH.trim() === '' ? null : Number(d.durationH),
  memo: d.memo,
})

function SymptomForm({ initial, submitLabel, onSubmit, extra }: { initial: SymptomDraft; submitLabel: string; onSubmit: (s: SymptomInput) => Promise<void>; extra?: React.ReactNode }) {
  const [d, setD] = useState(initial)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const set = (p: Partial<SymptomDraft>) => {
    setError(null)
    setD({ ...d, ...p })
  }
  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault()
        if (busy) return
        const input = toInput(d)
        const err = validateSymptom(input)
        if (err) return setError(err)
        setBusy(true)
        try {
          await onSubmit(input as SymptomInput)
          setD(emptyDraft())
        } finally {
          setBusy(false)
        }
      }}
    >
      <fieldset>
        <Label asChild>
          <legend>증상</legend>
        </Label>
        <ChipGroup label="증상 선택" columns={3} options={TYPES} value={d.type} onChange={(v) => set({ type: v })} />
      </fieldset>
      <fieldset>
        <Label asChild>
          <legend>강도 (1 약함 ~ 5 심함){d.severity && <span className="text-text-muted"> · {SEVERITY_TEXT[Number(d.severity)]}</span>}</legend>
        </Label>
        <ChipGroup label="강도" columns={5} options={SCALE} value={d.severity} onChange={(v) => set({ severity: v })} />
      </fieldset>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 sm:col-span-1">
          <Label htmlFor="symptomAt">언제부터</Label>
          <Input id="symptomAt" type="datetime-local" value={d.recordedAt} max={toDateTimeLocalValue(new Date())} onChange={(e) => set({ recordedAt: e.target.value })} />
        </div>
        <div className="col-span-2 sm:col-span-1">
          <Label htmlFor="symptomDur">지속 시간 (시간, 선택)</Label>
          <Input id="symptomDur" inputMode="decimal" value={d.durationH} onChange={(e) => set({ durationH: e.target.value })} />
        </div>
      </div>
      <div>
        <Label htmlFor="symptomMemo">메모 (선택)</Label>
        <Input id="symptomMemo" maxLength={200} placeholder="예: 저녁 먹고 나서" value={d.memo} onChange={(e) => set({ memo: e.target.value })} />
      </div>
      {error && <p role="alert" className="text-[13px] text-danger">{error}</p>}
      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? '저장 중…' : submitLabel}
      </Button>
      {extra}
    </form>
  )
}

/** /record/symptom — 오늘 컨디션 + 증상 기록 + 최근 증상 목록 */
export function SymptomPage() {
  const symptoms = useSymptoms()
  const todayKey = toDateKey(new Date())
  const todayDone = !!useDaily(todayKey) || symptoms.some((x) => toDateKey(new Date(x.recordedAt)) === todayKey)
  return (
    <>
      <PageHeader
        title="증상 · 컨디션"
        description={new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' })}
        back="/record"
        actions={todayDone ? <Badge tone="success">오늘 기록</Badge> : !isLive ? <MockBadge /> : undefined}
      />
      <div className="space-y-4 md:max-w-2xl">
        <DailyCard />
        <QuickSymptomCard />
        <section aria-labelledby="recent-symptoms">
          <h2 id="recent-symptoms" className="mb-2 text-[16px] font-bold">
            최근 증상
          </h2>
          {symptoms.length === 0 ? (
            <EmptyState icon={Activity} title="기록한 증상이 없어요" className="py-6" />
          ) : (
            <ul className="divide-y divide-border overflow-hidden rounded-card border border-border bg-surface">
              {symptoms.slice(0, 30).map((s) => (
                <li key={s.id}>
                  <Link to={`/record/symptom/${s.id}`} className="flex min-h-14 items-center gap-3 px-4 py-3 hover:bg-surface-muted/60" aria-label={`${SYMPTOM_LABEL[s.type]} 기록 수정`}>
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] font-semibold">
                        {SYMPTOM_LABEL[s.type]} <span className="text-[13px] font-normal text-text-muted">강도 {s.severity}</span>
                      </p>
                      <p className="tabular truncate text-[13px] text-text-muted">
                        {formatShortDateWithDay(new Date(s.recordedAt))} {formatTime(new Date(s.recordedAt))}
                        {s.durationH ? ` · ${s.durationH}시간` : ''}
                        {s.memo ? ` · ${s.memo}` : ''}
                      </p>
                    </div>
                    <AppIcon icon={ChevronRight} size="sm" tone="muted" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-[12px] leading-relaxed text-text-subtle">증상과 약의 관계는 판단하지 않아요. 투약 기록과 시간순으로 나란히 볼 수 있게 저장만 해요.</p>
        </section>
      </div>
    </>
  )
}

const draftOf = (s: Symptom): SymptomDraft => ({
  type: s.type,
  severity: String(s.severity),
  recordedAt: toDateTimeLocalValue(new Date(s.recordedAt)),
  durationH: s.durationH?.toString() ?? '',
  memo: s.memo ?? '',
})

/** /record/symptom/:id — 수정·삭제 */
export function SymptomEditPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const s = useRecordsStore((st) => st.symptoms.find((x) => x.id === id))
  const [confirm, setConfirm] = useState(false)
  if (!s) return <EmptyState title="기록을 찾을 수 없어요" action={<Button onClick={() => navigate('/record/symptom')}>목록으로</Button>} />
  return (
    <>
      <PageHeader title="증상 기록 수정" back="/record/symptom" />
      <Card className="md:max-w-[420px]">
        <SymptomForm
          initial={draftOf(s)}
          submitLabel="수정 저장"
          onSubmit={async (input) => {
            try {
              await editSymptom(s.id, input)
              toast.success('증상 기록을 수정했어요', { description: savedNote() })
              navigate('/record/symptom')
            } catch (e) {
              toast.error('수정하지 못했어요', { description: dbErrorMessage(e) })
              throw e
            }
          }}
          extra={
            <Button type="button" variant="ghost" className="w-full text-danger hover:bg-danger-soft hover:text-danger" onClick={() => setConfirm(true)}>
              기록 삭제
            </Button>
          }
        />
      </Card>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="이 증상 기록을 삭제할까요?"
        confirmLabel="삭제"
        tone="danger"
        onConfirm={async () => {
          try {
            await removeSymptom(s.id)
            toast('증상 기록을 삭제했어요', { description: savedNote() })
            navigate('/record/symptom')
          } catch (e) {
            toast.error('삭제하지 못했어요', { description: dbErrorMessage(e) })
          }
        }}
      />
    </>
  )
}
