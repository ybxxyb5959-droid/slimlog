import { LoaderCircle } from 'lucide-react'
import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router'

import { MockBadge } from '@/components/common/MockBadge'
import { PageHeader } from '@/components/common/PageHeader'
import { Button } from '@/components/ui/button'
import { getFood } from '@/services/foodCatalog'
import { classifyRegions } from '@/services/mealAi'
import { makeItem, newId } from '@/stores/mealStore'
import { useMealDraftStore, type DraftItem, type PhotoRegion } from '@/stores/mealDraftStore'

import { RegionEditor } from './RegionEditor'
import { SAMPLE_REGIONS, SampleMealArt } from './SampleMealArt'

/** 사진 영역 지정 → 영역별 AI 분석 (목업) → 식단 작성 화면에 결과 카드로 */
export function MealPhotoPage() {
  const navigate = useNavigate()
  const { photo, setPhoto, setPhotoItems, photoId } = useMealDraftStore()
  const [regions, setRegions] = useState<PhotoRegion[]>(photo?.regions ?? [])
  const [selected, setSelected] = useState<number | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  if (!photo) return <Navigate to="/record/meal/new" replace />

  const analyze = async (rs: PhotoRegion[]) => {
    setRegions(rs)
    setSelected(null)
    setAnalyzing(true)
    const preds = await classifyRegions(rs.length)
    const items: DraftItem[] = preds.map((p, i) => {
      const top = p.confident ? getFood(p.candidates[0]) : undefined
      const ai = { confident: p.confident && p.supported, candidates: p.candidates }
      if (top) return makeItem(top, top.servingGrams, { regionNo: i + 1, ai })
      return { id: newId('item'), foodId: null, name: '', grams: 0, kcal: 0, carbG: null, proteinG: null, fatG: null, regionNo: i + 1, ai }
    })
    setPhoto({ ...photo, regions: rs })
    setPhotoItems(items, photoId ?? newId('photo'))
    navigate('/record/meal/review', { replace: true })
  }

  return (
    <>
      <PageHeader title="음식 영역 지정" back="/record/meal/new" actions={<MockBadge label="목업 · 실제 AI 아님" />} />
      <div className="space-y-4 md:max-w-lg">
        <div>
          <p className="text-[17px] font-bold">음식마다 네모를 그려 주세요</p>
          <p className="mt-1 text-[13px] leading-relaxed text-text-muted">한 그릇에 하나씩 그리면 각각 분석해요. 영역을 끌어 옮기고, 선택한 영역의 오른쪽 아래 점으로 크기를 바꿔요.</p>
        </div>
        <RegionEditor regions={regions} onChange={setRegions} selected={selected} onSelect={setSelected} disabled={analyzing}>
          {photo.kind === 'file' ? <img src={photo.url} alt="고른 식사 사진" className="h-full w-full object-cover" draggable={false} /> : <SampleMealArt className="h-full w-full" />}
          {analyzing && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-slate-900/45 text-white" role="status">
              <LoaderCircle size={32} strokeWidth={1.75} className="animate-spin" aria-hidden />
              <p className="text-[15px] font-semibold">{regions.length}개 영역을 분석하고 있어요</p>
            </div>
          )}
        </RegionEditor>
        {!analyzing && (
          <>
            {photo.kind === 'sample' && regions.length === 0 && (
              <Button variant="secondary" className="w-full" onClick={() => setRegions(SAMPLE_REGIONS)}>
                예시 영역 5개 넣어 보기
              </Button>
            )}
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="lg" onClick={() => analyze([{ x: 0, y: 0, w: 100, h: 100 }])}>
                한 가지 음식이에요
              </Button>
              <Button size="lg" disabled={regions.length === 0} onClick={() => analyze(regions)}>
                {regions.length ? `${regions.length}개 분석하기` : '영역을 그려 주세요'}
              </Button>
            </div>
            <p className="text-[12px] text-text-subtle">지금은 학습한 20종(밥·국·찌개·반찬 포함) 안에서만 인식해요. 사진은 목업이라 서버로 보내지 않아요.</p>
          </>
        )}
      </div>
    </>
  )
}
