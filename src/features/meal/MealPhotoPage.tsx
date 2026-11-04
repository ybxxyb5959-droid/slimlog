import { LoaderCircle, ScanSearch } from 'lucide-react'
import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router'
import { toast } from 'sonner'

import { BottomSheet } from '@/components/common/BottomSheet'
import { MockBadge } from '@/components/common/MockBadge'
import { PageHeader } from '@/components/common/PageHeader'
import { Button } from '@/components/ui/button'
import { getFood } from '@/services/foodCatalog'
import { CONSENT_ITEMS } from '@/fixtures/consents'
import { ApiError, apiReady } from '@/lib/api'
import { dbErrorMessage } from '@/lib/supabase'
import { saveConsents } from '@/services/live/account'
import { cacheFoods } from '@/services/foodCatalog'
import { fetchFoodsByIds } from '@/services/live/meals'
import { getModelStatus, recognizeMeal, recognizeMealLive, type RecognitionResult } from '@/services/mealAi'
import { useAuthStore } from '@/stores/authStore'
import { makeItem, newId } from '@/stores/mealStore'
import { useMealDraftStore, type DraftItem } from '@/stores/mealDraftStore'

import { SampleMealArt } from './SampleMealArt'

/**
 * 사진 1장 → 음식 인식 → 식단 작성 화면에 후보 목록으로.
 * 실서비스: 서버가 Gemini 로 음식 이름·예상 분량만 받고, 영양은 식약처 DB 로 계산한다 (브라우저는 Gemini 를 직접 부르지 않음).
 * 서버가 없으면 목업 결과로 시연한다. AI 가 실패해도 직접 입력으로 이어간다.
 */
export function MealPhotoPage() {
  const navigate = useNavigate()
  const draft = useMealDraftStore()
  const { photo, setPhotoItems, photoId } = draft
  const account = useAuthStore((s) => s.account)
  const [analyzing, setAnalyzing] = useState(false)
  const [askConsent, setAskConsent] = useState(false)
  const [failed, setFailed] = useState(false)
  const mock = !apiReady && getModelStatus() !== 'ready'
  if (!photo) return <Navigate to="/record/meal/new" replace />

  const toItems = (res: RecognitionResult & { labels: { predId?: string }[] }): DraftItem[] =>
    res.labels.map((l) => {
      const ai = {
        status: l.status, candidates: l.candidates, score: l.score, threshold: l.threshold, modelVersion: res.modelVersion, mode: res.mode,
        predId: (l as { predId?: string }).predId, nameRaw: l.nameRaw, confidence: l.confidence, servings: l.servings, portionText: l.portionText, reason: l.reason,
      }
      const food = l.foodId ? getFood(l.foodId) : undefined
      // 확실한 것만 바로 담고(기본 제공량 × AI 추정 인분), 나머지는 사용자가 고를 때까지 비워 둔다
      if (l.status === 'recognized' && food) return makeItem(food, Math.round(food.servingGrams * (l.servings ?? 1)), { fromPhoto: true, ai })
      return { id: newId('item'), foodId: null, name: '', grams: 0, kcal: 0, carbG: null, proteinG: null, fatG: null, fromPhoto: true, ai }
    })

  const goManual = () => navigate('/record/meal/review', { replace: true })

  const analyze = async () => {
    setAnalyzing(true)
    setFailed(false)
    let res: RecognitionResult & { mealId?: string; labels: { predId?: string }[] }
    try {
      if (apiReady) {
        // 실서비스: 서버가 사진을 저장·인식하고 초안 식사를 만든다 → 후보 음식 정보를 불러와 둔다
        if (!photo.file) throw new Error('사진 파일을 다시 골라 주세요.')
        res = await recognizeMealLive(photo.file, draft.mealType, new Date(draft.eatenAt).toISOString())
        cacheFoods(await fetchFoodsByIds([...new Set(res.labels.flatMap((l) => l.candidates))]))
      } else res = await recognizeMeal(photo)
    } catch (e) {
      setAnalyzing(false)
      if (e instanceof ApiError && e.code === 'NO_FOOD_AI_CONSENT') return setAskConsent(true)
      setFailed(true)
      if (e instanceof ApiError && ['DAILY_LIMIT', 'SERVICE_LIMIT', 'LIMIT_CHECK_FAILED'].includes(e.code))
        return void toast.error(e.message, { action: { label: '직접 입력', onClick: goManual } })
      return void toast.error('사진을 분석하지 못했어요', { description: (e as Error).message, action: { label: '직접 입력', onClick: goManual } })
    }
    if (res.aiError) toast(res.aiError.code === 'NOT_FOOD' ? '사진에서 음식을 찾지 못했어요' : 'AI 분석이 안 됐어요', { description: '음식을 직접 추가해 주세요. 사진은 기록에 남아요.' })
    setPhotoItems(toItems(res), res.mealId ?? photoId ?? newId('photo'))
    navigate('/record/meal/review', { replace: true })
  }

  const agreeAndAnalyze = async () => {
    if (!account) return
    try {
      await saveConsents(account.userId, ['food_ai'])
      await useAuthStore.getState().refreshAccount()
    } catch (e) {
      return void toast.error('동의를 저장하지 못했어요', { description: dbErrorMessage(e) })
    }
    setAskConsent(false)
    void analyze()
  }

  const ai = CONSENT_ITEMS.find((c) => c.id === 'food_ai')!

  return (
    <>
      <PageHeader title="사진 속 음식 찾기" back="/record/meal/new" actions={mock ? <MockBadge label="목업 · 실제 AI 아님" /> : undefined} />
      <div className="space-y-4 md:max-w-lg">
        <div>
          <p className="text-[17px] font-bold">사진 한 장에서 음식을 한꺼번에 찾아요</p>
          <p className="mt-1 text-[13px] leading-relaxed text-text-muted">찾은 음식은 다음 화면에서 고치거나 빼고, 빠진 음식은 직접 추가할 수 있어요.</p>
        </div>
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-surface-muted">
          {photo.kind === 'file' ? <img src={photo.url} alt="고른 식사 사진" className="h-full w-full object-cover" /> : <SampleMealArt className="h-full w-full" />}
          {analyzing && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-slate-900/45 text-white" role="status">
              <LoaderCircle size={32} strokeWidth={1.75} className="animate-spin" aria-hidden />
              <p className="text-[15px] font-semibold">음식을 찾고 있어요</p>
            </div>
          )}
        </div>
        {!analyzing && (
          <>
            <div className="grid grid-cols-[auto_1fr] gap-2">
              <Button asChild variant="outline" size="lg">
                <Link to="/record/meal/new">다른 사진</Link>
              </Button>
              <Button size="lg" onClick={analyze}>
                <ScanSearch size={18} strokeWidth={1.75} aria-hidden /> 음식 인식하기
              </Button>
            </div>
            {failed && (
              <Button variant="secondary" size="lg" className="w-full" onClick={goManual}>
                직접 입력으로 기록하기
              </Button>
            )}
            {apiReady && (
              <p className="text-[12px] leading-relaxed text-text-subtle">
                사진은 서버에서 위치정보(EXIF)를 지운 뒤 비공개로 저장되고, 음식 인식을 위해 Google Gemini로 전송돼요. 음식만 나오게 찍어 주세요. 하루 10회까지 분석할 수 있어요.
              </p>
            )}
            {mock && (
              <p className="rounded-xl bg-review-soft px-3 py-2 text-[12px] leading-relaxed text-review">
                지금은 AI가 연결되지 않아 <b>고정된 예시 결과</b>를 보여줘요. 고른 사진 내용을 실제로 분석하지 않고, 사진은 서버로 보내지 않아요.
              </p>
            )}
          </>
        )}
      </div>

      <BottomSheet open={askConsent} onRequestClose={() => setAskConsent(false)} title={ai.title} description="처음 한 번만 물어봐요. 마이 > 동의 관리에서 언제든 철회할 수 있어요.">
        <ul className="list-disc space-y-1.5 pl-5 text-[13px] leading-relaxed text-text-muted">
          {ai.detail.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button variant="outline" size="lg" onClick={() => { setAskConsent(false); goManual() }}>
            직접 입력할게요
          </Button>
          <Button size="lg" onClick={agreeAndAnalyze}>
            동의하고 분석
          </Button>
        </div>
      </BottomSheet>
    </>
  )
}
