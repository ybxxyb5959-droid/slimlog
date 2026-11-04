import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'

import { ChipGroup } from '@/components/common/ChipGroup'
import { PageHeader } from '@/components/common/PageHeader'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { CATEGORY_LABEL, type Post, type PostCategory } from '@/fixtures/community.mock'
import { checkPost, type SafetyResult } from '@/lib/communitySafety'
import { ApiError, apiReady, wakeServer } from '@/lib/api'
import { isLive } from '@/lib/supabase'
import { createPost, editPost } from '@/services/live/community'
import { useAuthStore } from '@/stores/authStore'
import { loadCommunity, useCommunityStore } from '@/stores/communityStore'

import { HighlightedText, SafetyResultBox } from './SafetyResultBox'


/** 글쓰기·수정 — 게시 전 안전 검사 (수정도 다시 검사) */
export function PostWritePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const existing = useCommunityStore((s) => s.posts.find((p) => p.id === id))
  const savePost = useCommunityStore((s) => s.savePost)
  const [category, setCategory] = useState<PostCategory | null>(existing?.category ?? null)
  const [title, setTitle] = useState(existing?.title ?? '')
  const [body, setBody] = useState(existing?.body ?? '')
  const [checked, setChecked] = useState<SafetyResult | null>(null)

  // 입력이 바뀌면 이전 검사 결과는 무효
  const live = useMemo(() => checkPost(title, body), [title, body])
  const result = checked && JSON.stringify(checked) === JSON.stringify(live) ? checked : null
  const canSubmit = !!category && title.trim().length > 1 && body.trim().length > 4

  const [submitting, setSubmitting] = useState(false)
  const [slow, setSlow] = useState(false)
  useEffect(() => wakeServer(), [])
  const submit = async () => {
    const r = checkPost(title, body)
    setChecked(r)
    if (r.level === 'BLOCKED') return
    if (isLive) {
      // 실서비스: 서버가 같은 규칙으로 다시 검사하고 저장 (화면 검사는 미리보기일 뿐)
      if (!apiReady) return void toast('글쓰기는 서버 연결 후 열려요')
      setSubmitting(true)
      const slowTimer = window.setTimeout(() => setSlow(true), 2500)
      try {
        const input = { category: category!, title: title.trim(), body: body.trim() }
        const res = id ? await editPost(id, input) : await createPost(input)
        // 목록 전체를 다시 받을 때까지 기다리지 않고, 쓴 글을 바로 넣고 넘어간다 (목록은 뒤에서 새로고침)
        const status: Post['status'] = res.risk_level
        useCommunityStore.setState((st) => {
          const others = st.posts.filter((p) => p.id !== res.post_id)
          const base = st.posts.find((p) => p.id === res.post_id)
          const post: Post = {
            ...(base ?? { id: res.post_id, author: useAuthStore.getState().account?.nickname ?? '나', createdAt: new Date().toISOString(), likes: 0, comments: [], mine: true }),
            ...input,
            status,
          }
          return { posts: [post, ...others] }
        })
        void loadCommunity().catch(() => {})
        toast.success(res.risk_level === 'LOW' ? '게시됐어요' : '관리자 검토 후 공개돼요')
        navigate(`/community/${res.post_id}`)
      } catch (e) {
        toast.error(e instanceof ApiError && e.code === 'POST_BLOCKED' ? '올릴 수 없는 글이에요' : '저장하지 못했어요', { description: (e as Error).message })
      } finally {
        window.clearTimeout(slowTimer)
        setSubmitting(false)
        setSlow(false)
      }
      return
    }
    const newId = savePost({ id, category: category!, title: title.trim(), body: body.trim(), status: r.level })
    toast.success(r.level === 'LOW' ? '게시됐어요' : '관리자 검토 후 공개돼요')
    navigate(`/community/${newId}`)
  }

  return (
    <>
      <PageHeader title={existing ? '글 수정' : '글쓰기'} back={existing ? `/community/${existing.id}` : '/community'} />
      <div className="md:max-w-2xl">
        <Card className="space-y-5">
          <fieldset>
            <Label asChild>
              <legend>카테고리</legend>
            </Label>
            <ChipGroup
              label="카테고리"
              options={(Object.entries(CATEGORY_LABEL) as [PostCategory, string][]).map(([value, label]) => ({ value, label }))}
              value={category}
              onChange={setCategory}
            />
          </fieldset>
          <div>
            <Label htmlFor="postTitle">제목</Label>
            <Input id="postTitle" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} placeholder="제목을 입력하세요" />
          </div>
          <div>
            <Label htmlFor="postBody">내용</Label>
            <Textarea id="postBody" value={body} onChange={(e) => setBody(e.target.value)} maxLength={2000} placeholder="경험과 기록을 나눠 주세요" />
            <p className="mt-1 text-right text-[12px] text-text-subtle">{body.length} / 2000</p>
          </div>

          {result && result.level !== 'LOW' && (
            <div className="rounded-xl border border-border px-4 py-3 text-[14px] leading-relaxed whitespace-pre-line" aria-label="걸린 문구 미리보기">
              <HighlightedText text={`${title}\n${body}`} result={result} />
            </div>
          )}
          {result && <SafetyResultBox result={result} />}

          <Button size="lg" className="w-full" onClick={submit} disabled={!canSubmit || submitting || result?.level === 'BLOCKED'}>
            {submitting ? (slow ? '서버를 깨우는 중이에요… (최대 1분)' : '올리는 중…') : existing ? '저장' : '게시하기'}
          </Button>
          <p className="text-[12px] leading-relaxed text-text-subtle">의약품 판매·양도·나눔, 용량 권유 글은 올릴 수 없거나 관리자 확인 뒤 공개돼요.</p>
        </Card>

      </div>
    </>
  )
}
