import { ChevronRight, Plus, Scale } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'

import { WeightChart } from '@/components/charts/WeightChart'
import { AppIcon } from '@/components/common/AppIcon'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { MockBadge } from '@/components/common/MockBadge'
import { PageHeader } from '@/components/common/PageHeader'
import { EmptyState } from '@/components/common/StateViews'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { formatShortDateWithDay, formatTime, toDateTimeLocalValue } from '@/lib/date'
import { dbErrorMessage, isLive } from '@/lib/supabase'
import { addBody, editBody, findLikelyDuplicate, removeBody, useBodyLogs, type BodyInput } from '@/services/body'
import { savedNote } from '@/services/doses'
import { useMyProfile } from '@/services/profile'
import { useRecordsStore, type BodyEntry } from '@/stores/recordsStore'

import { BodyForm } from './BodyForm'
import { emptyBodyDraft, type BodyDraft } from './bodyDraft'

const fmt = (n?: number) => (n === undefined ? null : n.toFixed(1))

/** /record/body — 체중·체성분 목록과 변화 그래프 */
export function BodyLogListPage() {
  const logs = useBodyLogs()
  const { goalWeightKg } = useMyProfile()
  const latest = logs.at(-1)
  const first = logs[0]
  const diff = latest && first && logs.length > 1 ? Math.round((latest.weightKg - first.weightKg) * 10) / 10 : null

  return (
    <>
      <PageHeader
        title="체중 · 체성분"
        back="/record"
        actions={
          <Button asChild size="sm" className="h-10">
            <Link to="/record/body/new">
              <Plus size={18} strokeWidth={1.75} aria-hidden /> 새 기록
            </Link>
          </Button>
        }
      />
      <div className="space-y-4 md:max-w-2xl">
        {!isLive && <MockBadge />}
        {logs.length === 0 ? (
          <EmptyState
            icon={Scale}
            title="아직 체중 기록이 없어요"
            description="체중을 기록하면 변화 그래프가 여기에 보여요."
            action={
              <Button asChild>
                <Link to="/record/body/new">체중 기록하기</Link>
              </Button>
            }
          />
        ) : (
          <>
            <Card>
              <div className="flex items-baseline justify-between">
                <p className="text-[14px] text-text-muted">최근 체중</p>
                {goalWeightKg !== null && <p className="tabular text-[13px] text-text-muted">목표 {goalWeightKg}kg</p>}
              </div>
              <p className="tabular mt-1 text-[32px] font-bold">
                {latest!.weightKg.toFixed(1)}
                <span className="ml-1 text-[16px] font-semibold text-text-muted">kg</span>
              </p>
              {diff !== null && (
                <p className="tabular text-[14px] text-text-muted">
                  첫 기록 대비 {diff > 0 ? '+' : diff < 0 ? '−' : '±'}
                  {Math.abs(diff).toFixed(1)}kg
                </p>
              )}
              {logs.length > 1 ? (
                <div className="mt-4">
                  <WeightChart logs={logs} height={200} />
                </div>
              ) : (
                <p className="mt-3 text-[13px] text-text-subtle">기록이 2개 이상이면 변화 그래프가 보여요.</p>
              )}
            </Card>
            <ul className="divide-y divide-border overflow-hidden rounded-card border border-border bg-surface" aria-label="체중 기록 목록">
              {[...logs].reverse().map((l) => (
                <li key={l.id}>
                  <Link to={`/record/body/${l.id}`} className="flex min-h-16 items-center gap-3 px-4 py-3 hover:bg-surface-muted/60" aria-label={`${formatShortDateWithDay(new Date(l.measuredAt))} ${l.weightKg}kg 기록 수정`}>
                    <AppIcon icon={Scale} size="sm" tone="muted" />
                    <div className="min-w-0 flex-1">
                      <p className="tabular text-[16px] font-semibold">
                        {l.weightKg.toFixed(1)}kg {l.isBaseline && <Badge className="ml-1 align-middle">최초 체중</Badge>}
                      </p>
                      <p className="tabular truncate text-[13px] text-text-muted">
                        {formatShortDateWithDay(new Date(l.measuredAt))} {formatTime(new Date(l.measuredAt))}
                        {[fmt(l.skeletalMuscleKg) && ` · 골격근 ${fmt(l.skeletalMuscleKg)}kg`, fmt(l.bodyFatPct) && ` · 체지방 ${fmt(l.bodyFatPct)}%`].filter(Boolean).join('')}
                      </p>
                    </div>
                    <AppIcon icon={ChevronRight} size="sm" tone="muted" />
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </>
  )
}

const toDraft = (l: BodyEntry): BodyDraft => ({
  measuredAt: toDateTimeLocalValue(new Date(l.measuredAt)),
  weightKg: String(l.weightKg),
  skeletalMuscleKg: l.skeletalMuscleKg?.toString() ?? '',
  bodyFatKg: l.bodyFatKg?.toString() ?? '',
  bodyFatPct: l.bodyFatPct?.toString() ?? '',
})

/** /record/body/new · /record/body/:id */
export function BodyLogEditPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const existing = useRecordsStore((s) => s.bodyLogs.find((x) => x.id === id))
  const [draft, setDraft] = useState<BodyDraft>(() => (existing ? toDraft(existing) : emptyBodyDraft()))
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [dupFor, setDupFor] = useState<BodyInput | null>(null)
  const isNew = !id

  if (!isNew && !existing) return <EmptyState title="기록을 찾을 수 없어요" action={<Button onClick={() => navigate('/record/body')}>목록으로</Button>} />

  const save = async (input: BodyInput, force = false) => {
    // 10분 이내·0.1kg 이하 차이 기록이 있으면 한 번 확인 (같은 날 여러 번 재는 건 허용)
    if (!force && findLikelyDuplicate(input, useRecordsStore.getState().bodyLogs, id)) return setDupFor(input)
    try {
      if (isNew) await addBody(input)
      else await editBody(id!, input)
      toast.success(isNew ? '체중을 기록했어요' : '체중 기록을 수정했어요', { description: savedNote() })
      navigate('/record/body')
    } catch (e) {
      toast.error('저장하지 못했어요', { description: dbErrorMessage(e) })
    }
  }

  return (
    <>
      <PageHeader title={isNew ? '체중 기록하기' : '체중 기록 수정'} back="/record/body" />
      <Card className="md:max-w-[420px]">
        <BodyForm
          draft={draft}
          onChange={setDraft}
          submitLabel={isNew ? '저장' : '수정 저장'}
          onSubmit={(input) => save(input)}
          extraActions={
            !isNew &&
            (existing?.isBaseline ? (
              <p className="text-[12px] text-text-subtle">최초 체중은 삭제할 수 없어요. 마이 &gt; 신체 정보에서 시작 체중과 함께 바뀌어요.</p>
            ) : (
              <Button type="button" variant="ghost" className="w-full text-danger hover:bg-danger-soft hover:text-danger" onClick={() => setConfirmDelete(true)}>
                기록 삭제
              </Button>
            ))
          }
        />
      </Card>
      <ConfirmDialog
        open={!!dupFor}
        onOpenChange={(o) => !o && setDupFor(null)}
        title="비슷한 기록이 이미 있어요"
        description="10분 안에 거의 같은 체중이 기록되어 있어요. 그래도 저장할까요?"
        confirmLabel="그래도 저장"
        onConfirm={() => {
          const v = dupFor
          setDupFor(null)
          if (v) void save(v, true)
        }}
      />
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="이 체중 기록을 삭제할까요?"
        description="그래프와 분석에서도 사라져요."
        confirmLabel="삭제"
        tone="danger"
        onConfirm={async () => {
          try {
            await removeBody(id!)
            toast('체중 기록을 삭제했어요', { description: savedNote() })
            navigate('/record/body')
          } catch (e) {
            toast.error('삭제하지 못했어요', { description: dbErrorMessage(e) })
          }
        }}
      />
    </>
  )
}
