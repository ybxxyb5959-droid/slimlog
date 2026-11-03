import { api } from '@/lib/api'
import { sb } from '@/lib/supabase'
import type { Post, PostCategory } from '@/fixtures/community.mock'
import type { SafetyLevel } from '@/lib/communitySafety'

/**
 * 커뮤니티 — 읽기·좋아요·신고는 Supabase 직접(RLS), 쓰기(글·댓글)는 서버(금칙어 검사) 경유
 * posts.status → 화면 상태: visible=LOW, hidden=REVIEW(검토 중, 작성자만), blocked=BLOCKED(관리자가 막음)
 */
const STATUS: Record<string, SafetyLevel> = { visible: 'LOW', hidden: 'REVIEW', blocked: 'BLOCKED' }

type Row = {
  post_id: string
  user_id: string
  category: string
  title: string
  body: string
  status: string
  like_count: number
  created_at: string
  author: { nickname: string | null } | null
  comments: { comment_id: string; user_id: string; body: string; created_at: string; deleted_at: string | null; status: string; author: { nickname: string | null } | null }[]
}

export async function fetchPosts(userId: string, limit = 50): Promise<Post[]> {
  const db = sb()
  const [posts, likes] = await Promise.all([
    db
      .from('posts')
      .select('post_id, user_id, category, title, body, status, like_count, created_at, author:users!posts_user_id_fkey(nickname), comments(comment_id, user_id, body, created_at, deleted_at, status, author:users!comments_user_id_fkey(nickname))')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(limit),
    db.from('post_likes').select('post_id').eq('user_id', userId),
  ])
  if (posts.error) throw posts.error
  if (likes.error) throw likes.error
  const liked = new Set(likes.data.map((l) => l.post_id))
  return (posts.data as unknown as Row[]).map((r) => ({
    id: r.post_id,
    category: r.category as PostCategory,
    title: r.title,
    body: r.body,
    author: r.author?.nickname ?? '알 수 없음',
    createdAt: r.created_at,
    likes: r.like_count,
    liked: liked.has(r.post_id),
    status: STATUS[r.status] ?? 'REVIEW',
    mine: r.user_id === userId,
    comments: r.comments
      .filter((c) => !c.deleted_at && (c.status === 'visible' || c.user_id === userId))
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((c) => ({ id: c.comment_id, author: c.author?.nickname ?? '알 수 없음', body: c.body, createdAt: c.created_at, mine: c.user_id === userId })),
  }))
}

export async function setLike(postId: string, userId: string, on: boolean) {
  const db = sb()
  const r = on ? await db.from('post_likes').insert({ post_id: postId, user_id: userId }) : await db.from('post_likes').delete().eq('post_id', postId).eq('user_id', userId)
  if (r.error && r.error.code !== '23505') throw r.error
}

const REASON: Record<string, string> = { trade: 'sale', dose: 'dose_advice', ad: 'ad', abuse: 'abuse', privacy: 'privacy', etc: 'other' }
export async function reportPost(postId: string, userId: string, reason: string) {
  const r = await sb().from('reports').insert({ reporter_id: userId, target_type: 'post', target_id: postId, reason: REASON[reason] ?? 'other' })
  if (r.error?.code === '23505') throw new Error('이미 신고한 글이에요.')
  if (r.error) throw r.error
}

export const createPost = (p: { category: PostCategory; title: string; body: string }) =>
  api<{ post_id: string; risk_level: SafetyLevel; status: string }>('/posts', { json: p })
export const editPost = (id: string, p: { category: PostCategory; title: string; body: string }) =>
  api<{ post_id: string; risk_level: SafetyLevel; status: string }>(`/posts/${id}`, { method: 'PATCH', json: p })
export const deletePost = (id: string) => api(`/posts/${id}`, { method: 'DELETE' })
export const createComment = (postId: string, body: string) => api<{ comment_id: string; status: string }>(`/posts/${postId}/comments`, { json: { body } })
export const deleteComment = (id: string) => api(`/comments/${id}`, { method: 'DELETE' })

// ── 관리자 검토 (RLS: is_admin 만 전체 조회) ───────────────────
export interface ModerationRow {
  id: string
  postTitle: string
  excerpt: string
  body: string
  author: string
  status: string
  reports: number
  reportIds: string[]
  createdAt: string
}

export async function fetchModerationQueue(): Promise<ModerationRow[]> {
  const db = sb()
  const reps = await db.from('reports').select('report_id, target_id').eq('status', 'open').eq('target_type', 'post')
  if (reps.error) throw reps.error
  const reported = [...new Set(reps.data.map((r) => r.target_id))]
  const cols = 'post_id, title, body, status, created_at, author:users!posts_user_id_fkey(nickname)'
  const [hidden, flagged] = await Promise.all([
    db.from('posts').select(cols).eq('status', 'hidden').is('deleted_at', null),
    reported.length ? db.from('posts').select(cols).in('post_id', reported).is('deleted_at', null) : Promise.resolve({ data: [], error: null }),
  ])
  if (hidden.error) throw hidden.error
  if (flagged.error) throw flagged.error
  const map = new Map<string, ModerationRow>()
  for (const p of [...(hidden.data ?? []), ...(flagged.data ?? [])] as unknown as { post_id: string; title: string; body: string; status: string; created_at: string; author: { nickname: string } | null }[]) {
    const ids = reps.data.filter((r) => r.target_id === p.post_id).map((r) => r.report_id)
    map.set(p.post_id, { id: p.post_id, postTitle: p.title, excerpt: p.body.slice(0, 80), body: p.body, author: p.author?.nickname ?? '알 수 없음', status: p.status, reports: ids.length, reportIds: ids, createdAt: p.created_at })
  }
  return [...map.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function fetchAuditLogs() {
  const r = await sb()
    .from('admin_actions')
    .select('action_id, action, target_type, target_id, reason, created_at, admin:users!admin_actions_admin_id_fkey(nickname)')
    .order('created_at', { ascending: false })
    .limit(20)
  if (r.error) throw r.error
  return r.data as unknown as { action_id: number; action: string; target_type: string; target_id: string; reason: string; created_at: string; admin: { nickname: string } | null }[]
}

/** 승인 = 공개 + 신고 기각 / 숨김·반려 = 막기 + 신고 처리 완료. 서버가 관리자 권한을 다시 확인하고 기록한다 */
export async function moderate(row: ModerationRow, decision: '승인' | '반려' | '숨김', reason: string) {
  await api('/admin/actions', { json: { target_type: 'post', target_id: row.id, action: decision === '승인' ? 'restore' : 'hide', reason } })
  for (const rid of row.reportIds) await api('/admin/actions', { json: { target_type: 'report', target_id: rid, action: decision === '승인' ? 'dismiss' : 'hide', reason } })
}
