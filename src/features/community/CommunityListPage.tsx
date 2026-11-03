import { Heart, MessageCircle, PenLine, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'

import { AppIcon } from '@/components/common/AppIcon'
import { MockBadge } from '@/components/common/MockBadge'
import { PageHeader } from '@/components/common/PageHeader'
import { EmptyState } from '@/components/common/StateViews'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CATEGORY_LABEL, type PostCategory } from '@/fixtures/community.mock'
import { relativeTime } from '@/lib/relativeTime'
import { cn } from '@/lib/utils'
import { useCommunityStore } from '@/stores/communityStore'

type Filter = 'all' | 'mine' | PostCategory
const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: '전체' },
  ...(Object.entries(CATEGORY_LABEL) as [PostCategory, string][]).map(([value, label]) => ({ value, label })),
  { value: 'mine', label: '내 글' },
]

export function CommunityListPage() {
  const posts = useCommunityStore((s) => s.posts)
  const [filter, setFilter] = useState<Filter>('all')
  // REVIEW·BLOCKED 글은 목록에 노출하지 않고, 작성자 본인의 '내 글'에서만 보인다
  const visible = posts.filter((p) =>
    filter === 'mine' ? p.mine : p.status === 'LOW' && (filter === 'all' || p.category === filter),
  )

  return (
    <>
      <PageHeader
        title="커뮤니티"
        description="경험과 기록을 나눠요"
        actions={
          <Button asChild size="sm" className="h-10">
            <Link to="/community/write">
              <PenLine size={18} strokeWidth={1.75} aria-hidden /> 글쓰기
            </Link>
          </Button>
        }
      />

      <p className="mb-4 flex items-start gap-2 rounded-xl bg-surface-muted px-4 py-3 text-[13px] leading-relaxed text-text-muted">
        <AppIcon icon={ShieldCheck} size="sm" className="mt-px size-[18px]" />
        의약품 판매·양도·나눔과 용량 권유 글은 게시 전에 자동으로 걸러지고, 관리자가 확인해요.
      </p>

      <div role="tablist" aria-label="카테고리" className="no-scrollbar -mx-5 mb-4 flex gap-2 overflow-x-auto px-5 md:mx-0 md:px-0">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            role="tab"
            aria-selected={filter === f.value}
            onClick={() => setFilter(f.value)}
            className={cn(
              'h-9 shrink-0 rounded-full border px-4 text-[13px] font-medium transition-colors',
              filter === f.value ? 'border-text bg-text text-surface' : 'border-border bg-surface text-text-muted hover:bg-surface-muted',
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="mb-2 flex justify-end">
        <MockBadge />
      </div>
      {visible.length === 0 ? (
        <EmptyState title="아직 글이 없어요" description="첫 글을 남겨 보세요." />
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-card border border-border bg-surface md:max-w-3xl">
          {visible.map((p) => (
            <li key={p.id}>
              <Link to={`/community/${p.id}`} className="block px-5 py-4 hover:bg-surface-muted/50">
                <div className="flex items-center gap-2">
                  <Badge>{CATEGORY_LABEL[p.category]}</Badge>
                  {p.status === 'REVIEW' && <Badge tone="review">검토 중 · 나만 보임</Badge>}
                  {p.status === 'BLOCKED' && <Badge tone="danger">게시 불가</Badge>}
                </div>
                <p className="mt-2 truncate text-[16px] font-semibold text-text">{p.title}</p>
                <p className="mt-0.5 line-clamp-2 text-[14px] leading-relaxed text-text-muted">{p.body}</p>
                <div className="mt-2.5 flex items-center gap-3 text-[12px] text-text-subtle">
                  <span>{p.author}</span>
                  <span>{relativeTime(p.createdAt)}</span>
                  <span className="ml-auto inline-flex items-center gap-1">
                    <Heart size={14} strokeWidth={1.75} aria-hidden /> {p.likes}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <MessageCircle size={14} strokeWidth={1.75} aria-hidden /> {p.comments.length}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
