import { Star } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { toast } from 'sonner'

import { PageHeader } from '@/components/common/PageHeader'
import { EmptyState } from '@/components/common/StateViews'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { amountLabel, fmtG } from '@/lib/nutrition'
import { isLive } from '@/lib/supabase'
import { getFood, lastGramsOf } from '@/services/foodCatalog'
import { makeItem, useMealStore } from '@/stores/mealStore'
import { useMealDraftStore } from '@/stores/mealDraftStore'

import { AmountEditor } from './mealParts'

/** 검색 결과 선택 → 영양 자동 입력 → 섭취량 수정 → 식단에 추가 */
export function FoodDetailPage() {
  const { foodId } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const food = getFood(foodId)
  const addItems = useMealDraftStore((s) => s.addItems)
  const favorites = useMealStore((s) => s.favorites)
  const toggleFavorite = useMealStore((s) => s.toggleFavorite)
  const [grams, setGrams] = useState(() => Number(params.get('grams')) || (food ? (lastGramsOf(food.id) ?? food.servingGrams) : 100))

  if (!food)
    return (
      <EmptyState
        title="음식을 찾을 수 없어요"
        action={
          <Button asChild>
            <Link to="/record/meal/search">다시 검색</Link>
          </Button>
        }
      />
    )
  const fav = favorites.includes(food.id)

  return (
    <>
      <PageHeader
        title={food.name}
        description={food.brand}
        back="/record/meal/search"
        actions={
          <button type="button" onClick={() => toggleFavorite(food.id)} aria-pressed={fav} aria-label={`즐겨찾기 ${fav ? '해제' : '추가'}`} className="inline-flex size-11 items-center justify-center rounded-full hover:bg-surface-muted">
            <Star size={22} strokeWidth={1.75} className={fav ? 'fill-review text-review' : 'text-text-muted'} aria-hidden />
          </button>
        }
      />
      <div className="space-y-4 pb-28 md:max-w-lg">
        <Card className="p-4">
          <p className="text-[13px] text-text-muted">
            영양 기준 <b className="text-text">{food.basisLabel}</b> <span className="text-text-subtle">· {isLive ? (food.custom ? '직접 등록한 값' : '식약처 식품영양성분 DB') : '목업 예시 값'}</span>
          </p>
          <dl className="tabular mt-2 grid grid-cols-4 gap-1 text-center">
            {(
              [
                ['칼로리', `${food.kcal}`],
                ['탄수', fmtG(food.carbG)],
                ['단백질', fmtG(food.proteinG)],
                ['지방', fmtG(food.fatG)],
              ] as const
            ).map(([l, v]) => (
              <div key={l} className="rounded-xl bg-surface-muted py-2">
                <dt className="text-[11px] text-text-muted">{l}</dt>
                <dd className="text-[14px] font-semibold">{v}</dd>
              </div>
            ))}
          </dl>
        </Card>
        <Card>
          <h2 className="mb-3 text-[16px] font-bold">얼마나 드셨나요?</h2>
          <AmountEditor food={food} grams={grams} onChange={setGrams} />
        </Card>
      </div>
      <div className="fixed inset-x-0 bottom-[calc(4rem+var(--sab))] z-20 border-t border-border bg-surface/95 px-5 py-3 backdrop-blur md:bottom-0 md:left-20 lg:left-60">
        <div className="mx-auto max-w-lg">
          <Button
            size="lg"
            className="w-full"
            disabled={!(grams > 0)}
            onClick={() => {
              addItems([makeItem(food, grams)])
              toast.success(`${food.name} ${amountLabel(grams, food)}을 담았어요`)
              navigate('/record/meal/review')
            }}
          >
            식단에 추가
          </Button>
        </div>
      </div>
    </>
  )
}
