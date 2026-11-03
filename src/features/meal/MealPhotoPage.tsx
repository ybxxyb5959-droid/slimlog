import { LoaderCircle, ScanSearch } from 'lucide-react'
import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router'

import { MockBadge } from '@/components/common/MockBadge'
import { PageHeader } from '@/components/common/PageHeader'
import { Button } from '@/components/ui/button'
import { getFood } from '@/services/foodCatalog'
import { getModelStatus, recognizeMeal } from '@/services/mealAi'
import { makeItem, newId } from '@/stores/mealStore'
import { useMealDraftStore, type DraftItem } from '@/stores/mealDraftStore'

import { SampleMealArt } from './SampleMealArt'

/**
 * 사진 1장 → 음식 인식 (멀티라벨) → 식단 작성 화면에 후보 목록으로.
 * 영역을 그리지 않는다. 모델이 없으면 목업 결과로 시연한다.
 */
export function MealPhotoPage() {
  const navigate = useNavigate()
  const { photo, setPhotoItems, photoId } = useMealDraftStore()
  const [analyzing, setAnalyzing] = useState(false)
  const mock = getModelStatus() !== 'ready'
  if (!photo) return <Navigate to="/record/meal/new" replace />

  const analyze = async () => {
    setAnalyzing(true)
    const res = await recognizeMeal(photo)
    const items: DraftItem[] = res.labels.map((l) => {
      const ai = { status: l.status, candidates: l.candidates, score: l.score, threshold: l.threshold, modelVersion: res.modelVersion, mode: res.mode }
      const food = getFood(l.foodId)
      // '인식 결과'는 바로 담고, '확인 필요'는 사용자가 후보에서 고를 때까지 비워 둔다
      if (l.status === 'recognized' && food) return makeItem(food, food.servingGrams, { fromPhoto: true, ai })
      return { id: newId('item'), foodId: null, name: '', grams: 0, kcal: 0, carbG: null, proteinG: null, fatG: null, fromPhoto: true, ai }
    })
    setPhotoItems(items, photoId ?? newId('photo'))
    navigate('/record/meal/review', { replace: true })
  }

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
            {mock && (
              <p className="rounded-xl bg-review-soft px-3 py-2 text-[12px] leading-relaxed text-review">
                지금은 AI 모델이 연결되지 않아 <b>고정된 예시 결과</b>를 보여줘요. 고른 사진 내용을 실제로 분석하지 않고, 사진은 서버로 보내지 않아요.
              </p>
            )}
          </>
        )}
      </div>
    </>
  )
}
