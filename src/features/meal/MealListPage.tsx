import { Camera, Images, Pencil, Trash2, Utensils } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { toast } from 'sonner'

import { AppIcon } from '@/components/common/AppIcon'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { MockBadge } from '@/components/common/MockBadge'
import { PageHeader } from '@/components/common/PageHeader'
import { EmptyState } from '@/components/common/StateViews'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { daysBetween, formatTime } from '@/lib/date'
import { amountLabel, fmtG, sumNutrients } from '@/lib/nutrition'
import { getFood } from '@/services/foodCatalog'
import { isNewUser } from '@/services/session'
import { useMealDraftStore } from '@/stores/mealDraftStore'
import { useMealStore } from '@/stores/mealStore'
import type { MealRecord } from '@/types/meal'

const TYPE_LABEL = { breakfast: '아침', lunch: '점심', dinner: '저녁', snack: '간식' } as const
const dayLabel = (iso: string) => {
  const n = daysBetween(new Date(iso), new Date())
  return n === 0 ? '오늘' : n === 1 ? '어제' : new Date(iso).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })
}

/** 식단 목록 — 식사 기록 1건 = 카드 1장 (같은 끼니라도 따로 저장했으면 따로) */
export function MealListPage() {
  const navigate = useNavigate()
  const records = useMealStore((s) => s.records)
  const removeRecord = useMealStore((s) => s.removeRecord)
  const draft = useMealDraftStore()
  const [toDelete, setToDelete] = useState<MealRecord | null>(null)
  const sorted = [...records].sort((a, b) => b.eatenAt.localeCompare(a.eatenAt))
  const days = [...new Set(sorted.map((r) => dayLabel(r.eatenAt)))]
  const today = sumNutrients(sorted.filter((r) => dayLabel(r.eatenAt) === '오늘').flatMap((r) => r.items))

  return (
    <>
      <PageHeader
        title="AI 식단"
        back="/record"
        actions={
          <Button
            size="sm"
            className="h-10"
            onClick={() => {
              if (draft.editingId) draft.reset()
              navigate('/record/meal/new')
            }}
          >
            <Camera size={18} strokeWidth={1.75} aria-hidden /> 기록하기
          </Button>
        }
      />
      <div className="space-y-4 md:max-w-2xl">
        <Card>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[13px] text-text-muted">오늘 섭취</p>
              <p className="tabular text-[28px] font-bold">
                {today.kcal.toLocaleString()}
                <span className="ml-1 text-[15px] font-semibold text-text-muted">kcal</span>
              </p>
            </div>
            {!isNewUser() && <MockBadge />}
          </div>
          <p className="tabular mt-1 text-[13px] text-text-muted">
            탄 {today.carbG}g · 단 {today.proteinG}g · 지 {today.fatG}g
          </p>
        </Card>

        {sorted.length === 0 && (
          <EmptyState
            icon={Utensils}
            title="식단 기록이 없어요"
            description="사진 한 장으로 여러 반찬도 함께 기록할 수 있어요."
            action={
              <Button asChild>
                <Link to="/record/meal/new">기록하기</Link>
              </Button>
            }
          />
        )}

        {days.map((day) => (
          <section key={day} className="space-y-3">
            <h2 className="px-1 text-[14px] font-semibold text-text-muted">{day}</h2>
            {sorted
              .filter((r) => dayLabel(r.eatenAt) === day)
              .map((r) => {
                const t = sumNutrients(r.items)
                return (
                  <Card key={r.id} className="p-0" aria-label={`${TYPE_LABEL[r.mealType]} ${formatTime(new Date(r.eatenAt))} 식사 기록`}>
                    <div className="flex items-center gap-2 px-5 pt-4 pb-2">
                      <p className="flex-1 text-[16px] font-bold">
                        {TYPE_LABEL[r.mealType]} <span className="tabular ml-1 text-[13px] font-medium text-text-muted">{formatTime(new Date(r.eatenAt))}</span>
                      </p>
                      {r.photoId ? (
                        <Badge>
                          <Images size={12} strokeWidth={1.75} aria-hidden /> 사진 1장
                        </Badge>
                      ) : (
                        <Badge>사진 없이 기록</Badge>
                      )}
                      <span className="tabular text-[15px] font-semibold">{t.kcal.toLocaleString()}kcal</span>
                    </div>
                    <ul className="divide-y divide-border">
                      {r.items.map((i) => (
                        <li key={i.id} className="flex min-h-12 items-center gap-3 px-5 py-2">
                          <AppIcon icon={Utensils} size="sm" tone="muted" className="size-[18px]" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[15px]">
                              {i.name} {i.regionNo === undefined && r.photoId && <span className="text-[11px] text-text-subtle">직접 추가</span>}
                            </span>
                            <span className="tabular block text-[12px] text-text-muted">
                              {amountLabel(i.grams, getFood(i.foodId))} · 단백질 {fmtG(i.proteinG)}
                            </span>
                          </span>
                          <span className="tabular text-[13px] text-text-muted">{i.kcal}kcal</span>
                        </li>
                      ))}
                    </ul>
                    <div className="flex justify-end gap-1 border-t border-border px-3 py-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          draft.loadRecord(r)
                          navigate('/record/meal/review')
                        }}
                        aria-label={`${TYPE_LABEL[r.mealType]} ${formatTime(new Date(r.eatenAt))} 기록 수정`}
                      >
                        <Pencil size={15} strokeWidth={1.75} aria-hidden /> 수정
                      </Button>
                      <Button variant="ghost" size="sm" className="text-danger hover:bg-danger-soft hover:text-danger" onClick={() => setToDelete(r)} aria-label={`${TYPE_LABEL[r.mealType]} ${formatTime(new Date(r.eatenAt))} 기록 삭제`}>
                        <Trash2 size={15} strokeWidth={1.75} aria-hidden /> 삭제
                      </Button>
                    </div>
                  </Card>
                )
              })}
          </section>
        ))}
      </div>
      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="이 식사 기록을 삭제할까요?"
        description="담긴 음식이 모두 삭제되고 합계에서 빠져요."
        confirmLabel="삭제"
        tone="danger"
        onConfirm={() => {
          removeRecord(toDelete!.id)
          toast('식사 기록을 삭제했어요')
          setToDelete(null)
        }}
      />
    </>
  )
}
