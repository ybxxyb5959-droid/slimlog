import { Heart } from 'lucide-react'
import { Link } from 'react-router'

import { PageHeader } from '@/components/common/PageHeader'
import { EmptyState } from '@/components/common/StateViews'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CATEGORY_LABEL } from '@/fixtures/community.mock'
import { relativeTime } from '@/lib/relativeTime'
import { useCommunityLoad } from '@/features/community/useCommunityLoad'
import { useCommunityStore } from '@/stores/communityStore'

export function LikedPostsPage() {
  const posts = useCommunityStore((s) => s.posts)
  useCommunityLoad()
  const liked = posts.filter((p) => p.liked)
  return (
    <>
      <PageHeader title="공감한 글" back="/my" />
      {liked.length === 0 ? (
        <EmptyState
          icon={Heart}
          title="공감한 글이 없어요"
          description="커뮤니티 글에서 좋아요를 누르면 여기에 모여요."
          action={
            <Button asChild variant="outline">
              <Link to="/community">커뮤니티 보기</Link>
            </Button>
          }
        />
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-card border border-border bg-surface md:max-w-2xl">
          {liked.map((p) => (
            <li key={p.id}>
              <Link to={`/community/${p.id}`} className="block px-5 py-4 hover:bg-surface-muted/50">
                <Badge>{CATEGORY_LABEL[p.category]}</Badge>
                <p className="mt-2 truncate text-[16px] font-semibold">{p.title}</p>
                <p className="mt-1 text-[12px] text-text-subtle">
                  {p.author} · {relativeTime(p.createdAt)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
