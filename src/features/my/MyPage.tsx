import { ChevronRight, Heart, MessagesSquare, Ruler, Settings, UserRound, type LucideIcon } from 'lucide-react'
import { Link } from 'react-router'

import { AppIcon } from '@/components/common/AppIcon'
import { MockBadge } from '@/components/common/MockBadge'
import { PageHeader } from '@/components/common/PageHeader'
import { Card } from '@/components/ui/card'
import { useMyProfile } from '@/services/profile'
import { useCommunityStore } from '@/stores/communityStore'

function CardRow({ to, icon, title, description, meta }: { to: string; icon: LucideIcon; title: string; description: string; meta?: string }) {
  return (
    <Link to={to} className="flex min-h-[76px] items-center gap-4 rounded-card border border-border bg-surface px-5 py-4 hover:bg-surface-muted/60">
      <AppIcon icon={icon} size="md" />
      <span className="min-w-0 flex-1">
        <span className="block text-[16px] font-semibold text-text">{title}</span>
        <span className="block truncate text-[13px] text-text-muted">{description}</span>
      </span>
      {meta && <span className="tabular text-[13px] text-text-muted">{meta}</span>}
      <AppIcon icon={ChevronRight} size="sm" tone="muted" />
    </Link>
  )
}

/** 마이페이지 — 설정 메뉴는 우측 상단 톱니바퀴(설정 화면)로 분리 */
export function MyPage() {
  const p = useMyProfile()
  const posts = useCommunityStore((s) => s.posts)
  const myPosts = posts.filter((x) => x.mine).length
  const myComments = posts.reduce((n, x) => n + x.comments.filter((c) => c.mine).length, 0)
  const liked = posts.filter((x) => x.liked).length

  return (
    <>
      <PageHeader
        title="마이페이지"
        actions={
          <Link to="/my/settings" aria-label="설정" className="inline-flex size-11 items-center justify-center rounded-full hover:bg-surface-muted">
            <AppIcon icon={Settings} size="lg" tone="text" />
          </Link>
        }
      />
      <div className="space-y-4 md:max-w-2xl">
        <Link to="/my/profile" className="block">
          <Card className="flex items-center gap-4 hover:bg-surface-muted/40">
            <AppIcon icon={UserRound} size="lg" bg="success" tone="success" className="size-16 rounded-full [&>svg]:size-7" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[20px] font-bold">{p.nickname || '닉네임 없음'}</p>
              <p className="text-[14px] text-text-muted">프로필 편집</p>
            </div>
            {p.isExample && <MockBadge />}
            <AppIcon icon={ChevronRight} size="sm" tone="muted" />
          </Card>
        </Link>

        <Link to="/my/body" className="block rounded-card bg-primary-soft px-6 py-5 hover:brightness-[0.98]" aria-label="나의 목표 체중, 눌러서 수정">
          <div className="flex items-center justify-between">
            <p className="text-[15px] font-semibold text-primary">나의 목표 체중</p>
            <AppIcon icon={ChevronRight} size="sm" tone="success" />
          </div>
          <p className="tabular mt-2 text-[36px] leading-tight font-bold tracking-tight text-primary">
            {p.goalWeightKg !== null ? (
              <>
                {p.goalWeightKg}
                <span className="ml-1 text-[20px]">kg</span>
              </>
            ) : (
              <span className="text-[22px]">아직 정하지 않았어요</span>
            )}
          </p>
          <p className="mt-2 text-[13px] text-text-muted">내가 설정한 목표 · 눌러서 수정</p>
        </Link>

        <section className="pt-2">
          <h2 className="mb-2 px-1 text-[14px] font-semibold text-text-muted">나의 건강 관리</h2>
          <CardRow to="/my/body" icon={Ruler} title="신체 정보 · 목표 관리" description="키 · 시작 체중 · 목표 체중 설정" />
        </section>

        <section className="space-y-3 pt-2">
          <h2 className="px-1 text-[14px] font-semibold text-text-muted">나의 커뮤니티</h2>
          <CardRow to="/community?filter=mine" icon={MessagesSquare} title="내가 쓴 글 · 댓글" description="내 커뮤니티 활동 보기" meta={`글 ${myPosts} · 댓글 ${myComments}`} />
          <CardRow to="/my/liked" icon={Heart} title="공감한 글" description="관심 게시글 모아보기" meta={`${liked}개`} />
        </section>
      </div>
    </>
  )
}
