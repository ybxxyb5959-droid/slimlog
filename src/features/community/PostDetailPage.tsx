import { Flag, Heart, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'

import { AppIcon } from '@/components/common/AppIcon'
import { ChipGroup } from '@/components/common/ChipGroup'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { Notice } from '@/components/common/Notice'
import { PageHeader } from '@/components/common/PageHeader'
import { EmptyState, LoadingState } from '@/components/common/StateViews'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { CATEGORY_LABEL } from '@/fixtures/community.mock'
import { relativeTime } from '@/lib/relativeTime'
import { cn } from '@/lib/utils'
import { apiReady } from '@/lib/api'
import { dbErrorMessage, isLive } from '@/lib/supabase'
import { reportPost } from '@/services/live/community'
import { useAuthStore } from '@/stores/authStore'
import { useCommunityStore } from '@/stores/communityStore'

import { useCommunityLoad } from './useCommunityLoad'

const REPORT_REASONS = [
  { value: 'trade', label: '의약품 판매·양도' },
  { value: 'dose', label: '용량 권유' },
  { value: 'ad', label: '광고·홍보' },
  { value: 'abuse', label: '욕설·비방' },
  { value: 'privacy', label: '개인정보 노출' },
  { value: 'etc', label: '기타' },
]

export function PostDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const post = useCommunityStore((s) => s.posts.find((p) => p.id === id))
  const { toggleLike, addComment, removeComment, removePost } = useCommunityStore()
  const { loading } = useCommunityLoad()
  const [comment, setComment] = useState('')
  const [menu, setMenu] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [report, setReport] = useState(false)
  const [reason, setReason] = useState<string | null>(null)

  if (!post && loading) return <LoadingState title="글을 불러오는 중" />
  if (!post)
    return (
      <EmptyState
        title="글을 찾을 수 없어요"
        description="삭제되었거나 잘못된 주소예요."
        action={
          <Button asChild>
            <Link to="/community">커뮤니티로</Link>
          </Button>
        }
      />
    )

  return (
    <>
      <PageHeader
        title={CATEGORY_LABEL[post.category]}
        back="/community"
        actions={
          post.mine ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenu((v) => !v)}
                aria-expanded={menu}
                aria-label="글 메뉴"
                className="inline-flex size-11 items-center justify-center rounded-full hover:bg-surface-muted"
              >
                <AppIcon icon={MoreHorizontal} size="md" tone="text" />
              </button>
              {menu && (
                <div className="absolute top-12 right-0 z-20 w-36 overflow-hidden rounded-xl border border-border bg-surface shadow-[0_8px_24px_rgba(15,23,42,0.1)]">
                  <Link to={`/community/${post.id}/edit`} className="flex h-11 items-center gap-2 px-4 text-[14px] hover:bg-surface-muted">
                    <Pencil size={16} strokeWidth={1.75} aria-hidden /> 수정
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setMenu(false)
                      setConfirmDelete(true)
                    }}
                    className="flex h-11 w-full items-center gap-2 px-4 text-[14px] text-danger hover:bg-danger-soft"
                  >
                    <Trash2 size={16} strokeWidth={1.75} aria-hidden /> 삭제
                  </button>
                </div>
              )}
            </div>
          ) : undefined
        }
      />

      <div className="space-y-3 md:max-w-3xl">
        {post.status === 'REVIEW' && (
          <Notice tone="review" title="관리자 검토 중이에요">
            검토가 끝나기 전까지 다른 사람에게 보이지 않아요. 수정하면 다시 검사해요.
          </Notice>
        )}
        <Card>
          <div className="flex items-center gap-2 text-[13px] text-text-muted">
            <span className="font-semibold text-text">{post.author}</span>
            <span>·</span>
            <span>{relativeTime(post.createdAt)}</span>
            {post.mine && <Badge className="ml-auto">내 글</Badge>}
          </div>
          <h1 className="mt-3 text-[20px] leading-snug font-bold tracking-tight">{post.title}</h1>
          <p className="mt-3 text-[15px] leading-relaxed whitespace-pre-line text-text">{post.body}</p>
          <div className="mt-5 flex items-center gap-2 border-t border-border pt-4">
            <Button
              variant="outline"
              size="sm"
              aria-pressed={!!post.liked}
              onClick={() => toggleLike(post.id)}
              className={cn('h-10', post.liked && 'border-primary bg-primary-soft text-primary')}
            >
              <Heart size={17} strokeWidth={1.75} className={post.liked ? 'fill-current' : ''} aria-hidden /> 좋아요 {post.likes}
            </Button>
            {!post.mine && (
              <Button variant="ghost" size="sm" className="ml-auto h-10" onClick={() => setReport(true)}>
                <Flag size={16} strokeWidth={1.75} aria-hidden /> 신고
              </Button>
            )}
          </div>
        </Card>

        <Card>
          <h2 className="text-[15px] font-semibold">댓글 {post.comments.length}</h2>
          <ul className="mt-3 space-y-4">
            {post.comments.map((c) => (
              <li key={c.id} className="text-[14px]">
                <div className="flex items-center gap-2 text-[12px] text-text-muted">
                  <span className="font-semibold text-text">{c.author}</span>
                  <span>{relativeTime(c.createdAt)}</span>
                  {c.mine && (
                    <button type="button" onClick={() => removeComment(post.id, c.id)} className="ml-auto text-text-subtle hover:text-danger">
                      삭제
                    </button>
                  )}
                </div>
                <p className="mt-1 leading-relaxed">{c.body}</p>
              </li>
            ))}
            {post.comments.length === 0 && <li className="text-[14px] text-text-muted">첫 댓글을 남겨 보세요.</li>}
          </ul>
          <form
            className="mt-4 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              if (!comment.trim()) return
              addComment(post.id, comment.trim())
              setComment('')
            }}
          >
            <Input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="댓글을 입력하세요" aria-label="댓글" maxLength={300} />
            <Button type="submit" disabled={!comment.trim()} className="h-12 shrink-0">
              등록
            </Button>
          </form>
        </Card>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="이 글을 삭제할까요?"
        description="삭제한 글은 되돌릴 수 없어요."
        confirmLabel="삭제"
        tone="danger"
        onConfirm={() => {
          if (isLive && !apiReady) return void toast('지금은 글을 삭제할 수 없어요. 잠시 후 다시 시도해 주세요.')
          removePost(post.id)
          toast(isLive ? '글을 삭제했어요' : '목업: 화면에서만 삭제됐어요')
          navigate('/community')
        }}
      />

      <Dialog open={report} onOpenChange={setReport}>
        <DialogContent>
          <DialogTitle>신고하기</DialogTitle>
          <DialogDescription>신고 내용은 관리자가 확인해요. 신고한 사람은 공개되지 않아요.</DialogDescription>
          <ChipGroup label="신고 사유" columns={2} className="mt-4" options={REPORT_REASONS} value={reason} onChange={setReason} />
          <Button
            className="mt-5 w-full"
            size="lg"
            disabled={!reason}
            onClick={async () => {
              if (isLive) {
                try {
                  await reportPost(post.id, useAuthStore.getState().account!.userId, reason!)
                } catch (e) {
                  return void toast.error('신고하지 못했어요', { description: (e as Error).message || dbErrorMessage(e) })
                }
              }
              setReport(false)
              setReason(null)
              toast.success(isLive ? '신고가 접수됐어요' : '목업: 신고가 접수됐어요', { description: isLive ? '관리자가 확인해요.' : '실제로 전송되지 않아요.' })
            }}
          >
            신고 접수
          </Button>
        </DialogContent>
      </Dialog>
    </>
  )
}
