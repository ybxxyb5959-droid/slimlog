import { create } from 'zustand'

import { ME, MOCK_POSTS, type Post, type PostCategory } from '@/fixtures/community.mock'
import type { SafetyLevel } from '@/lib/communitySafety'

/**
 * 목업 전용 커뮤니티 상태 — 화면에만 반영되고 새로고침하면 사라진다.
 * 연결 예정 API: POST·PATCH·DELETE /posts, POST /posts/{id}/like, POST /reports
 */
interface CommunityState {
  posts: Post[]
  toggleLike: (id: string) => void
  addComment: (id: string, body: string) => void
  removeComment: (postId: string, commentId: string) => void
  savePost: (input: { id?: string; category: PostCategory; title: string; body: string; status: SafetyLevel }) => string
  removePost: (id: string) => void
}

export const useCommunityStore = create<CommunityState>((set) => ({
  posts: MOCK_POSTS,
  toggleLike: (id) =>
    set((s) => ({
      posts: s.posts.map((p) => (p.id === id ? { ...p, liked: !p.liked, likes: p.likes + (p.liked ? -1 : 1) } : p)),
    })),
  addComment: (id, body) =>
    set((s) => ({
      posts: s.posts.map((p) =>
        p.id === id
          ? { ...p, comments: [...p.comments, { id: `lc-${Date.now()}`, author: ME, body, createdAt: new Date().toISOString(), mine: true }] }
          : p,
      ),
    })),
  removeComment: (postId, commentId) =>
    set((s) => ({
      posts: s.posts.map((p) => (p.id === postId ? { ...p, comments: p.comments.filter((c) => c.id !== commentId) } : p)),
    })),
  savePost: ({ id, ...input }) => {
    const newId = id ?? `lp-${Date.now()}`
    set((s) => ({
      posts: id
        ? s.posts.map((p) => (p.id === id ? { ...p, ...input } : p))
        : [{ id: newId, ...input, author: ME, createdAt: new Date().toISOString(), likes: 0, comments: [], mine: true }, ...s.posts],
    }))
    return newId
  },
  removePost: (id) => set((s) => ({ posts: s.posts.filter((p) => p.id !== id) })),
}))
