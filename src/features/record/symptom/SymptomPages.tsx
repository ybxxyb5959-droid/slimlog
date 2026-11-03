import { Activity, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'

import { AppIcon } from '@/components/common/AppIcon'
import { ChipGroup } from '@/components/common/ChipGroup'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { MockBadge } from '@/components/common/MockBadge'
import { PageHeader } from '@/components/common/PageHeader'
import { EmptyState } from '@/components/common/StateViews'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SYMPTOM_LABEL } from '@/fixtures/records.mock'
import { formatShortDateWithDay, formatTime, localInputToIso, toDateKey, toDateTimeLocalValue } from '@/lib/date'
import { dbErrorMessage, isLive } from '@/lib/supabase'
import { savedNote } from '@/services/doses'
import { addSymptom, editSymptom, removeSymptom, saveDaily, useDaily, useSymptoms, validateSymptom, type SymptomInput } from '@/services/symptoms'
import { useRecordsStore } from '@/stores/recordsStore'
import type { Symptom, SymptomType } from '@/types/domain'

const SCALE = [1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: String(n) }))
const TYPES = (Object.keys(SYMPTOM_LABEL) as SymptomType[]).map((t) => ({ value: t, label: SYMPTOM_LABEL[t] }))
const SEVERITY_TEXT = ['', '약함', '조금', '보통', '꽤 심함', '심함']

/** 오늘 컨디션 — 날짜당 한 번, 다시 저장하면 고친다 */
function DailyCard() {
  const today = toDateKey(new Date())
  const saved = useDaily(today)
  const [condition, setCondition] = useState<string | null>(saved?.condition?.toString() ?? null)
  const [appetite, setAppetite] = useState<string | null>(saved?.appetite?.toString() ?? null)
  const [sleep, setSleep] = useState(saved?.sleepH?.toString() ?? '')
  const [busy, setBusy] = useState(false)
  const sleepNum = sleep.trim() === '' ? null : Number(sleep)
  const sleepErr = sleepNum !== null && (Number.isNaN(sleepNum) || sleepNum < 0 || sleepNum > 24) ? '0~24시간 사이로 입력해 주세요.' : null

  return (
    <Card className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-[16px] font-bold">오늘 컨디션</h2>
        {saved && <span className="text-[12px] text-primary">오늘 기록함</span>}
      </div>
      <fieldset>
        <Label asChild>
          <legend>전체 컨디션 (1 나쁨 ~ 5 좋음)</legend>
        </Label>
        <ChipGroup label="전체 컨디션" columns={5} options={SCALE} value={condition} onChange={setCondition} />
      </fieldset>
      <fieldset>
        <Label asChild>
          <legend>식욕 (1 없음 ~ 5 많음)</legend>
        </Label>
        <ChipGroup label="식욕" columns={5} options={SCALE} value={appetite} onChange={setAppetite} />
      </fieldset>
      <div>
        <Label htmlFor="sleepH">어젯밤 수면 (시간, 선택)</Label>
        <Input id="sleepH" inputMode="decimal" value={sleep} onChange={(e) => setSleep(e.target.value)} aria-invalid={!!sleepErr} />
        {sleepErr && <p className="mt-1.5 text-[13px] text-danger">{sleepErr}</p>}
      </div>
      <Button
        className="w-full"
        disabled={busy || !!sleepErr || (!condition && !appetite && sleepNum === null)}
        onClick={async () => {
          setBusy(true)
          try {
            await saveDaily({ date: today, condition: condition ? Number(condition) : null, appetite: appetite ? Number(appetite) : null, sleepH: sleepNum })
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
  return (
    <>
      <PageHeader title="증상 · 컨디션" back="/record" />
      <div className="space-y-4 md:max-w-2xl">
        {!isLive && <MockBadge />}
        <DailyCard />
        <Card>
          <h2 className="mb-3 text-[16px] font-bold">증상 기록</h2>
          <SymptomForm
            initial={emptyDraft()}
            submitLabel="증상 저장"
            onSubmit={async (s) => {
              try {
                await addSymptom(s)
                toast.success('증상을 기록했어요', { description: savedNote() })
              } catch (e) {
                toast.error('저장하지 못했어요', { description: dbErrorMessage(e) })
                throw e
              }
            }}
          />
        </Card>
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
