import { toast } from 'sonner'
import { create } from 'zustand'

import { ME, MOCK_POSTS, type Post, type PostCategory } from '@/fixtures/community.mock'
import { apiReady } from '@/lib/api'
import type { SafetyLevel } from '@/lib/communitySafety'
import { dbErrorMessage, isLive } from '@/lib/supabase'
import { createComment, deleteComment, deletePost, fetchPosts, setLike } from '@/services/live/community'
import { useAuthStore } from '@/stores/authStore'

/**
 * 커뮤니티 화면 상태
 * - 목업: 예시 글, 화면에만 반영
 * - 실서비스: loadCommunity() 로 DB 에서 불러오고, 좋아요는 직접 저장, 글·댓글 쓰기는 서버(금칙어 검사) 경유
 */
const uid = () => useAuthStore.getState().account?.userId ?? ''

export async function loadCommunity() {
  if (!isLive) return
  useCommunityStore.setState({ posts: await fetchPosts(uid()), loaded: true })
}

function persist(run: () => Promise<unknown>, undo: () => void, after?: () => void) {
  if (!isLive) return
  run()
    .then(() => after?.())
    .catch((e) => {
      undo()
      toast.error('처리하지 못했어요', { description: (e as Error).message || dbErrorMessage(e) })
    })
}
interface CommunityState {
  posts: Post[]
  /** 실서비스: DB 에서 한 번이라도 불러왔는지 */
  loaded: boolean
  toggleLike: (id: string) => void
  addComment: (id: string, body: string) => void
  removeComment: (postId: string, commentId: string) => void
  savePost: (input: { id?: string; category: PostCategory; title: string; body: string; status: SafetyLevel }) => string
  removePost: (id: string) => void
}

export const useCommunityStore = create<CommunityState>((set, get) => ({
  posts: isLive ? [] : MOCK_POSTS,
  loaded: !isLive,
  toggleLike: (id) => {
    const before = get().posts
    const on = !before.find((p) => p.id === id)?.liked
    set((s) => ({
      posts: s.posts.map((p) => (p.id === id ? { ...p, liked: !p.liked, likes: p.likes + (p.liked ? -1 : 1) } : p)),
    }))
    persist(() => setLike(id, uid(), on), () => set({ posts: before }))
  },
  addComment: (id, body) => {
    const me = useAuthStore.getState().account?.nickname ?? ME
    const temp = { id: `lc-${Date.now()}`, author: me, body, createdAt: new Date().toISOString(), mine: true }
    const before = get().posts
    set((s) => ({ posts: s.posts.map((p) => (p.id === id ? { ...p, comments: [...p.comments, temp] } : p)) }))
    if (isLive && !apiReady) {
      set({ posts: before })
      return void toast('댓글 쓰기는 서버 연결 후 열려요')
    }
    persist(
      () => createComment(id, body),
      () => set({ posts: before }),
      () => void loadCommunity().catch(() => {}), // 서버가 붙인 id·검사 상태로 다시 불러오기
    )
  },
  removeComment: (postId, commentId) => {
    const before = get().posts
    set((s) => ({ posts: s.posts.map((p) => (p.id === postId ? { ...p, comments: p.comments.filter((c) => c.id !== commentId) } : p)) }))
    persist(() => deleteComment(commentId), () => set({ posts: before }))
  },
  savePost: ({ id, ...input }) => {
    const newId = id ?? `lp-${Date.now()}`
    set((s) => ({
      posts: id
        ? s.posts.map((p) => (p.id === id ? { ...p, ...input } : p))
        : [{ id: newId, ...input, author: ME, createdAt: new Date().toISOString(), likes: 0, comments: [], mine: true }, ...s.posts],
    }))
    return newId
  },
  removePost: (id) => {
    const before = get().posts
    set((s) => ({ posts: s.posts.filter((p) => p.id !== id) }))
    persist(() => deletePost(id), () => set({ posts: before }))
  },
}))

// 로그인 사용자가 바뀌면(로그아웃·다른 계정) 이전 사람의 글 목록·좋아요 표시를 지운다
if (isLive)
  useAuthStore.subscribe((s, prev) => {
    if (s.account?.userId !== prev.account?.userId) useCommunityStore.setState({ posts: [], loaded: false })
  })
