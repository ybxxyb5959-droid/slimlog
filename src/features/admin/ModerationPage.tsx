import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { ChipGroup } from '@/components/common/ChipGroup'
import { MockBadge } from '@/components/common/MockBadge'
import { PageHeader } from '@/components/common/PageHeader'
import { EmptyState, ErrorState, LoadingState } from '@/components/common/StateViews'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { MOCK_AUDIT, MOCK_MODERATION, type AuditLog } from '@/fixtures/community.mock'
import { apiReady } from '@/lib/api'
import { checkPost } from '@/lib/communitySafety'
import { relativeTime } from '@/lib/relativeTime'
import { dbErrorMessage, isLive } from '@/lib/supabase'
import { fetchAuditLogs, fetchModerationQueue, moderate, type ModerationRow } from '@/services/live/community'
import { useAuthStore } from '@/stores/authStore'
import { cn } from '@/lib/utils'

type Action = AuditLog['action']

/** 관리자 검토 — REVIEW·BLOCKED·신고 글 처리. 조치에는 사유가 반드시 필요하고 감사 로그(ADMIN_ACTIONS)에 남는다 */
const ACTION_LABEL: Record<string, AuditLog['action']> = { restore: '승인', hide: '숨김', dismiss: '승인', delete: '반려' }

export function ModerationPage() {
  if (isLive) return <LiveModerationPage />
  return <MockModerationPage />
}

/** 실서비스: 숨김(REVIEW) 글 + 신고된 글을 DB 에서 불러와 서버 API 로 조치 */
function LiveModerationPage() {
  const role = useAuthStore((s) => s.account?.role)
  const [rows, setRows] = useState<ModerationRow[] | null>(null)
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (role !== 'admin') return
    Promise.all([fetchModerationQueue(), fetchAuditLogs()])
      .then(([q, a]) => {
        setRows(q)
        setLogs(a.map((l) => ({ id: String(l.action_id), at: l.created_at, admin: l.admin?.nickname ?? '관리자', action: ACTION_LABEL[l.action] ?? '숨김', target: `${l.target_type} ${l.target_id.slice(0, 8)}`, reason: l.reason })))
      })
      .catch((e) => setError(dbErrorMessage(e)))
  }, [role, tick])
  if (role !== 'admin') return <EmptyState title="관리자만 볼 수 있어요" description="관리자 권한은 DB 에서만 줄 수 있어요." />
  if (error) return <ErrorState description={error} action={<Button onClick={() => setTick((t) => t + 1)}>다시 불러오기</Button>} />
  if (!rows) return <LoadingState title="검토 목록을 불러오는 중" />
  return (
    <ModerationView
      queue={rows.map((r) => {
        const c = checkPost(r.postTitle, r.body)
        return { id: r.id, postTitle: r.postTitle, excerpt: r.excerpt, author: r.author, level: (c.level === 'LOW' ? 'REVIEW' : c.level) as 'REVIEW' | 'BLOCKED', rules: [...new Set(c.matches.map((m) => m.rule))], reports: r.reports, createdAt: r.createdAt }
      })}
      logs={logs}
      live
      onApply={async (id, action, reason) => {
        if (!apiReady) throw new Error('서버 연결 후 조치할 수 있어요.')
        await moderate(rows.find((r) => r.id === id)!, action, reason)
        setTick((t) => t + 1)
      }}
    />
  )
}

function MockModerationPage() {
  const [queue, setQueue] = useState(MOCK_MODERATION)
  const [logs, setLogs] = useState(MOCK_AUDIT)
  return (
    <ModerationView
      queue={queue}
      logs={logs}
      onApply={async (id, action, reason) => {
        const target = queue.find((q) => q.id === id)!
        setLogs((l) => [{ id: `a${Date.now()}`, at: new Date().toISOString(), admin: '관리자1', action, target: target.postTitle, reason }, ...l])
        setQueue((q) => q.filter((x) => x.id !== id))
      }}
    />
  )
}

type QueueItem = (typeof MOCK_MODERATION)[number]

function ModerationView({ queue, logs, onApply, live }: { queue: QueueItem[]; logs: AuditLog[]; onApply: (id: string, action: Action, reason: string) => Promise<void>; live?: boolean }) {
  const [selectedId, setSelectedId] = useState<string | null>(queue[0]?.id ?? null)
  const [action, setAction] = useState<Action | null>(null)
  const [reason, setReason] = useState('')
  const selected = queue.find((q) => q.id === selectedId)

  const [busy, setBusy] = useState(false)
  const apply = async () => {
    if (!selected || !action || reason.trim().length < 2) return
    setBusy(true)
    try {
      await onApply(selected.id, action, reason.trim())
    } catch (e) {
      setBusy(false)
      return void toast.error('조치하지 못했어요', { description: (e as Error).message })
    }
    setBusy(false)
    const rest = queue.filter((q) => q.id !== selected.id)
    setSelectedId(rest[0]?.id ?? null)
    setAction(null)
    setReason('')
    toast.success(live ? `${action} 처리했어요` : `목업: ${action} 처리했어요`, { description: live ? '감사 로그(ADMIN_ACTIONS)에 기록됐어요.' : '감사 로그에 기록됐어요 (화면에만 반영).' })
  }

  return (
    <>
      <PageHeader title="관리자 검토" description="자동 검사(REVIEW·BLOCKED)와 신고 글을 처리해요" actions={live ? undefined : <MockBadge />} />
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card className="p-0">
          <h2 className="px-5 pt-4 pb-2 text-[15px] font-semibold">검토 대기 {queue.length}건</h2>
          {queue.length === 0 ? (
            <EmptyState title="대기 중인 글이 없어요" className="py-8" />
          ) : (
            <ul role="listbox" aria-label="검토 대기 목록" className="divide-y divide-border">
              {queue.map((q) => (
                <li key={q.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={q.id === selectedId}
                    onClick={() => setSelectedId(q.id)}
                    className={cn('block w-full px-5 py-3.5 text-left hover:bg-surface-muted/60', q.id === selectedId && 'bg-surface-muted')}
                  >
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge tone={q.level === 'BLOCKED' ? 'danger' : 'review'}>{q.level}</Badge>
                      {q.rules.map((r) => (
                        <Badge key={r}>{r}</Badge>
                      ))}
                      {q.reports > 0 && <Badge tone="danger">신고 {q.reports}</Badge>}
                    </div>
                    <p className="mt-1.5 truncate text-[15px] font-semibold">{q.postTitle}</p>
                    <p className="truncate text-[13px] text-text-muted">
                      {q.author} · {relativeTime(q.createdAt)}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="space-y-4">
          {selected && (
            <Card className="space-y-4">
              <div>
                <p className="text-[13px] text-text-muted">선택한 글</p>
                <p className="mt-0.5 text-[16px] font-bold">{selected.postTitle}</p>
                <p className="mt-2 rounded-xl bg-surface-muted px-4 py-3 text-[14px] leading-relaxed">{selected.excerpt}</p>
              </div>
              <fieldset>
                <Label asChild>
                  <legend>조치</legend>
                </Label>
                <ChipGroup
                  label="조치 선택"
                  columns={3}
                  options={[
                    { value: '승인', label: '승인' },
                    { value: '반려', label: '반려' },
                    { value: '숨김', label: '숨김' },
                  ]}
                  value={action}
                  onChange={(v) => setAction(v as Action)}
                />
              </fieldset>
              <div>
                <Label htmlFor="adminReason">사유 (필수)</Label>
                <Textarea id="adminReason" value={reason} onChange={(e) => setReason(e.target.value)} className="min-h-24" placeholder="조치 사유를 입력해 주세요" />
              </div>
              <Button size="lg" className="w-full" disabled={!action || reason.trim().length < 2 || busy} onClick={apply}>
                조치 저장
              </Button>
              {!reason.trim() && <p className="text-[12px] text-text-subtle">사유를 입력해야 저장할 수 있어요.</p>}
            </Card>
          )}

          <Card>
            <h2 className="text-[15px] font-semibold">감사 로그</h2>
            <ul className="mt-3 space-y-3">
              {logs.map((l) => (
                <li key={l.id} className="text-[13px]">
                  <div className="flex items-center gap-2">
                    <Badge tone={l.action === '승인' ? 'success' : l.action === '반려' ? 'danger' : 'neutral'}>{l.action}</Badge>
                    <span className="truncate font-semibold">{l.target}</span>
                    <span className="ml-auto shrink-0 text-text-subtle">{relativeTime(l.at)}</span>
                  </div>
                  <p className="mt-1 text-text-muted">
                    {l.admin} · {l.reason}
                  </p>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </>
  )
}
