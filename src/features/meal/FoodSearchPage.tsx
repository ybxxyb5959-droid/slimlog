import { useNavigate } from 'react-router'
import { toast } from 'sonner'

import { PageHeader } from '@/components/common/PageHeader'
import { makeItem } from '@/stores/mealStore'
import { useMealDraftStore } from '@/stores/mealDraftStore'

import { FoodSearchPanel } from './mealParts'

/** 음식 직접 추가 — 검색 → 선택(상세) / + 로 1인분 바로 담기 */
export function FoodSearchPage() {
  const navigate = useNavigate()
  const addItems = useMealDraftStore((s) => s.addItems)
  const count = useMealDraftStore((s) => s.items.length)
  return (
    <>
      <PageHeader title="음식 직접 추가" back={count ? '/record/meal/review' : '/record/meal/new'} />
      <div className="md:max-w-lg">
        <FoodSearchPanel
          autoFocus
          onPick={(f) => navigate(`/record/meal/food/${f.id}`)}
          onQuickAdd={(f) => {
            addItems([makeItem(f, f.servingGrams)])
            toast.success(`${f.name} 1인분을 담았어요`, { action: { label: '식단 보기', onClick: () => navigate('/record/meal/review') } })
          }}
          onCreateCustom={(name) => navigate(`/record/meal/custom?name=${encodeURIComponent(name)}`)}
        />
      </div>
    </>
  )
}
