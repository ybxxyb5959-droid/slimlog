import { Camera, Images, Utensils, X } from 'lucide-react'
import { Link } from 'react-router'

import { AppIcon } from '@/components/common/AppIcon'
import { MockBadge } from '@/components/common/MockBadge'
import { PageHeader } from '@/components/common/PageHeader'
import { EmptyState } from '@/components/common/StateViews'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { formatTime } from '@/lib/date'
import { isNewUser } from '@/services/session'
import { useMealStore } from '@/stores/mealStore'
import type { MealType } from '@/types/domain'

const ORDER: { type: MealType; label: string }[] = [
  { type: 'breakfast', label: '아침' },
  { type: 'lunch', label: '점심' },
  { type: 'dinner', label: '저녁' },
  { type: 'snack', label: '간식' },
]

export function MealListPage() {
  const meals = useMealStore((s) => s.meals)
  const removeMeal = useMealStore((s) => s.removeMeal)
  const today = meals.filter((m) => new Date(m.eatenAt).toDateString() === new Date().toDateString())
  const kcal = today.reduce((a, m) => a + m.kcal, 0)
  const protein = today.reduce((a, m) => a + m.proteinG, 0)

  return (
    <>
      <PageHeader
        title="AI 식단"
        back="/record"
        actions={
          <Button asChild size="sm" className="h-10">
            <Link to="/record/meal/new">
              <Camera size={18} strokeWidth={1.75} aria-hidden /> 기록하기
            </Link>
          </Button>
        }
      />
      <div className="space-y-4 md:max-w-2xl">
        <Card className="flex items-end justify-between">
          <div>
            <p className="text-[13px] text-text-muted">오늘 섭취</p>
            <p className="tabular text-[28px] font-bold">
              {kcal.toLocaleString()}
              <span className="ml-1 text-[15px] font-semibold text-text-muted">kcal</span>
            </p>
            <p className="tabular text-[13px] text-text-muted">단백질 {protein}g · {today.length}가지 음식</p>
          </div>
          {!isNewUser() && <MockBadge />}
        </Card>

        {today.length === 0 ? (
          <EmptyState
            icon={Utensils}
            title="오늘 식단 기록이 없어요"
            description="사진 한 장으로 여러 반찬도 함께 기록할 수 있어요."
            action={
              <Button asChild>
                <Link to="/record/meal/new">사진으로 기록하기</Link>
              </Button>
            }
          />
        ) : (
          ORDER.flatMap(({ type, label }) => {
            const ofType = today.filter((m) => m.mealType === type).sort((a, b) => a.eatenAt.localeCompare(b.eatenAt))
            // 같은 사진에서 나온 음식끼리 한 카드, 그 외는 끼니별 한 카드
            const groups = new Map<string, typeof ofType>()
            for (const m of ofType) {
              const k = m.photoGroupId ?? 'manual'
              groups.set(k, [...(groups.get(k) ?? []), m])
            }
            return [...groups.entries()].map(([gk, list]) => {
            const groupKcal = list.reduce((a, m) => a + m.kcal, 0)
            const fromPhoto = gk !== 'manual'
            return (
              <Card key={`${type}-${gk}`} className="p-0">
                <div className="flex items-center justify-between px-5 pt-4 pb-2">
                  <p className="text-[16px] font-bold">
                    {label} <span className="tabular ml-1 text-[13px] font-medium text-text-muted">{formatTime(new Date(list[0].eatenAt))}</span>
                  </p>
                  <span className="flex items-center gap-2">
                    {fromPhoto && (
                      <Badge>
                        <Images size={12} strokeWidth={1.75} aria-hidden /> 사진 1장
                      </Badge>
                    )}
                    <span className="tabular text-[14px] font-semibold">{groupKcal.toLocaleString()}kcal</span>
                  </span>
                </div>
                <ul className="divide-y divide-border">
                  {list.map((m) => (
                    <li key={m.id} className="flex min-h-13 items-center gap-3 px-5 py-2.5">
                      <AppIcon icon={Utensils} size="sm" tone="muted" className="size-[18px]" />
                      <span className="flex-1 text-[15px]">
                        {m.foodName} <span className="text-[13px] text-text-muted">{m.servings}인분</span>
                        {m.corrected && <span className="ml-1.5 text-[11px] text-text-subtle">직접 고침</span>}
                      </span>
                      <span className="tabular text-[13px] text-text-muted">{m.kcal}kcal</span>
                      <button type="button" onClick={() => removeMeal(m.id)} aria-label={`${m.foodName} 기록 삭제`} className="inline-flex size-9 items-center justify-center rounded-full hover:bg-surface-muted">
                        <AppIcon icon={X} size="sm" tone="muted" className="size-[18px]" />
                      </button>
                    </li>
                  ))}
                </ul>
              </Card>
            )
            })
          })
        )}
      </div>
    </>
  )
}
