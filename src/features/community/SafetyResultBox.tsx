import { ShieldAlert, ShieldBan, ShieldCheck } from 'lucide-react'

import { AppIcon } from '@/components/common/AppIcon'
import type { SafetyResult } from '@/lib/communitySafety'
import { cn } from '@/lib/utils'

/** 게시 전 안전 검사 결과 — 초록=게시 가능, 주황=관리자 검토, 빨강=차단 */
export function SafetyResultBox({ result }: { result: SafetyResult }) {
  const rules = [...new Set(result.matches.map((m) => m.rule))]
  const style = {
    LOW: { icon: ShieldCheck, tone: 'success', box: 'border-primary/30 bg-primary-soft', title: '바로 게시할 수 있어요', text: 'text-primary' },
    REVIEW: { icon: ShieldAlert, tone: 'review', box: 'border-review-border bg-review-soft', title: '관리자 검토 후 공개돼요', text: 'text-review' },
    BLOCKED: { icon: ShieldBan, tone: 'danger', box: 'border-danger-border bg-danger-soft', title: '게시할 수 없는 내용이 있어요', text: 'text-danger' },
  }[result.level]

  return (
    <div role="status" className={cn('rounded-2xl border px-4 py-3.5', style.box)}>
      <p className={cn('flex items-center gap-2 text-[15px] font-bold', style.text)}>
        <AppIcon icon={style.icon} size="sm" tone={style.tone as 'success' | 'review' | 'danger'} />
        {style.title}
      </p>
      <div className="mt-1.5 space-y-1 text-[13px] leading-relaxed text-text-muted">
        {result.level === 'LOW' && <p>안전 검사에서 문제가 발견되지 않았어요.</p>}
        {result.level === 'REVIEW' && (
          <p>
            {rules.join(' · ')} 내용이 있어 관리자가 확인한 뒤 공개돼요. 검토 중에는 목록에 보이지 않고 내 글에서만 볼 수 있어요.
          </p>
        )}
        {result.level === 'BLOCKED' && (
          <p>
            전문의약품은 개인 간 판매·양도·나눔이 금지되어 있어요. 남은 약은 약국·보건소 폐의약품 수거함을 이용해 주세요. 표시된 문구를 고치면 다시
            검사할 수 있어요.
          </p>
        )}
      </div>
    </div>
  )
}

/** 본문에서 걸린 문구를 강조 */
export function HighlightedText({ text, result }: { text: string; result: SafetyResult }) {
  if (!result.matches.length) return <>{text}</>
  const out: React.ReactNode[] = []
  let cursor = 0
  for (const m of result.matches) {
    if (m.start < cursor) continue
    out.push(text.slice(cursor, m.start))
    out.push(
      <mark
        key={m.start}
        className={cn(
          'rounded px-0.5 font-semibold underline decoration-2 underline-offset-4',
          m.level === 'BLOCKED' ? 'bg-danger-soft text-danger' : 'bg-review-soft text-review',
        )}
      >
        {text.slice(m.start, m.end)}
      </mark>,
    )
    cursor = m.end
  }
  out.push(text.slice(cursor))
  return <>{out}</>
}
