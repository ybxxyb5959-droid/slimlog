import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'

import { ChipGroup } from '@/components/common/ChipGroup'
import { PageHeader } from '@/components/common/PageHeader'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { CATEGORY_LABEL, type PostCategory } from '@/fixtures/community.mock'
import { checkPost, type SafetyResult } from '@/lib/communitySafety'
import { ApiError, apiReady } from '@/lib/api'
import { isLive } from '@/lib/supabase'
import { createPost, editPost } from '@/services/live/community'
import { loadCommunity, useCommunityStore } from '@/stores/communityStore'

import { HighlightedText, SafetyResultBox } from './SafetyResultBox'

const EXAMPLES = [
  { label: 'LOW 예시', title: '3주차 식단 기록', body: '3주차인데 단백질 챙기려고 계란을 늘렸어요.' },
  { label: 'REVIEW 예시', title: '증량 고민', body: '몇 mg부터 올리세요? 제가 알려드릴게요.' },
  { label: 'BLOCKED 예시', title: '남은 펜 처리 고민', body: '용량 올리면서 5mg 펜이 남았는데 필요하신 분 양 도해요. 쪽지 주세요.' },
]

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
  const submit = async () => {
    const r = checkPost(title, body)
    setChecked(r)
    if (r.level === 'BLOCKED') return
    if (isLive) {
      // 실서비스: 서버가 같은 규칙으로 다시 검사하고 저장 (화면 검사는 미리보기일 뿐)
      if (!apiReady) return void toast('글쓰기는 서버 연결 후 열려요')
      setSubmitting(true)
      try {
        const input = { category: category!, title: title.trim(), body: body.trim() }
        const res = id ? await editPost(id, input) : await createPost(input)
        await loadCommunity()
        toast.success(res.risk_level === 'LOW' ? '게시됐어요' : '관리자 검토 후 공개돼요')
        navigate(`/community/${res.post_id}`)
      } catch (e) {
        toast.error(e instanceof ApiError && e.code === 'POST_BLOCKED' ? '올릴 수 없는 글이에요' : '저장하지 못했어요', { description: (e as Error).message })
      } finally {
        setSubmitting(false)
      }
      return
    }
    const newId = savePost({ id, category: category!, title: title.trim(), body: body.trim(), status: r.level })
    toast.success(r.level === 'LOW' ? '목업: 게시됐어요' : '목업: 관리자 검토 후 공개돼요', { description: '화면에만 반영되고 서버에 저장되지 않아요.' })
    navigate(`/community/${newId}`)
  }

  return (
    <>
      <PageHeader title={existing ? '글 수정' : '글쓰기'} back={existing ? `/community/${existing.id}` : '/community'} />
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
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

          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" size="lg" onClick={() => setChecked(checkPost(title, body))} disabled={!title && !body}>
              검사해 보기
            </Button>
            <Button size="lg" onClick={submit} disabled={!canSubmit || submitting || result?.level === 'BLOCKED'}>
              {existing ? '다시 검사 후 저장' : '게시하기'}
            </Button>
          </div>
        </Card>

        <Card className="space-y-3">
          <h2 className="text-[15px] font-semibold">검사 결과 예시 넣어 보기</h2>
          <p className="text-[13px] text-text-muted">목업 확인용이에요. 누르면 입력칸에 예시 문장이 들어가요.</p>
          {EXAMPLES.map((ex) => (
            <Button
              key={ex.label}
              variant="secondary"
              className="w-full justify-start"
              onClick={() => {
                setCategory('free')
                setTitle(ex.title)
                setBody(ex.body)
                setChecked(checkPost(ex.title, ex.body))
              }}
            >
              {ex.label}
            </Button>
          ))}
          <p className="text-[12px] leading-relaxed text-text-subtle">
            판매·양도·나눔·처방전 없이 구매 → BLOCKED / 용량·증량 권유, 병원·약국 상호 → REVIEW / 그 외 → LOW. 띄어쓰기·특수문자를 지우고 비교해요(‘양 도’ → ‘양도’).
          </p>
        </Card>
      </div>
    </>
  )
}
