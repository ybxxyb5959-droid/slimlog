import { Coffee, Images, Moon, Pencil, Plus, Sun, Sunrise, Trash2, type LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { MockBadge } from '@/components/common/MockBadge'
import { PageHeader } from '@/components/common/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { daysBetween, formatTime } from '@/lib/date'
import { amountLabel, fmtG, sumNutrients } from '@/lib/nutrition'
import { MACRO_META } from '@/lib/nutritionMeta'
import { cn } from '@/lib/utils'
import { getFood } from '@/services/foodCatalog'
import { isNewUser } from '@/services/session'
import { isPhotoItem, useMealDraftStore } from '@/stores/mealDraftStore'
import { useIntakeStore } from '@/stores/intakeStore'
import { useMealStore } from '@/stores/mealStore'
import type { MealRecord } from '@/types/meal'

import { NutritionGoalSheet } from '../goals/NutritionGoalSheet'

const TYPE_LABEL = { breakfast: '아침', lunch: '점심', dinner: '저녁', snack: '간식' } as const
const dayLabel = (iso: string) => {
  const n = daysBetween(new Date(iso), new Date())
  return n === 0 ? '오늘' : n === 1 ? '어제' : new Date(iso).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })
}

const MEAL_ORDER = ['breakfast', 'lunch', 'dinner', 'snack'] as const
const MEAL_ICON: Record<(typeof MEAL_ORDER)[number], { icon: LucideIcon; color: string }> = {
  breakfast: { icon: Sunrise, color: 'var(--nutri-carb)' },
  lunch: { icon: Sun, color: 'var(--nutri-carb)' },
  dinner: { icon: Moon, color: 'var(--nutri-fat)' },
  snack: { icon: Coffee, color: 'var(--nutri-protein)' },
}

/**
 * 오늘의 식단 — 오늘 섭취 열량(목표 대비) · 탄단지 → 끼니별 카드(아침·점심·저녁·간식, + 로 바로 추가) → 사진으로 기록하기.
 * 지난 날짜 기록은 아래 '지난 기록'에 날짜별로. 식사 기록 1건 = 카드 1장.
 */
export function MealListPage() {
  const navigate = useNavigate()
  const records = useMealStore((s) => s.records)
  const removeRecord = useMealStore((s) => s.removeRecord)
  const draft = useMealDraftStore()
  const goals = {
    kcal: useIntakeStore((s) => s.kcalGoal),
    carbG: useIntakeStore((s) => s.carbGoalG),
    proteinG: useIntakeStore((s) => s.proteinGoalG),
    fatG: useIntakeStore((s) => s.fatGoalG),
  }
  const [toDelete, setToDelete] = useState<MealRecord | null>(null)
  const [goalOpen, setGoalOpen] = useState(false)
  const sorted = [...records].sort((a, b) => b.eatenAt.localeCompare(a.eatenAt))
  const todays = sorted.filter((r) => dayLabel(r.eatenAt) === '오늘')
  const pastDays = [...new Set(sorted.filter((r) => dayLabel(r.eatenAt) !== '오늘').map((r) => dayLabel(r.eatenAt)))]
  const today = sumNutrients(todays.flatMap((r) => r.items))
  const kcalPct = goals.kcal ? Math.round((today.kcal / goals.kcal) * 100) : null

  const startNew = (mealType?: (typeof MEAL_ORDER)[number]) => {
    draft.reset()
    if (mealType) draft.setMeta({ mealType })
    navigate('/record/meal/new')
  }

  const recordCard = (r: MealRecord, compact = false) => {
    const t = sumNutrients(r.items)
    return (
      <section key={r.id} aria-label={`${TYPE_LABEL[r.mealType]} ${formatTime(new Date(r.eatenAt))} 식사 기록`} className={cn('rounded-2xl border border-border bg-surface', compact && 'bg-surface-muted/40')}>
        <div className="flex items-center gap-2 px-4 pt-3 pb-1.5">
          <p className="flex-1 text-[14px] font-semibold">
            {compact ? '' : `${TYPE_LABEL[r.mealType]} `}
            <span className="tabular text-[13px] font-medium text-text-muted">{formatTime(new Date(r.eatenAt))}</span>
          </p>
          {r.photoId ? (
            <Badge>
              <Images size={12} strokeWidth={1.75} aria-hidden /> 사진 1장
            </Badge>
          ) : (
            <Badge>사진 없이 기록</Badge>
          )}
          <span className="tabular text-[14px] font-semibold">{t.kcal.toLocaleString()}kcal</span>
        </div>
        <ul className="divide-y divide-border">
          {r.items.map((i) => (
            <li key={i.id} className="flex min-h-11 items-center gap-3 px-4 py-1.5">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px]">
                  {i.name} {!isPhotoItem(i) && r.photoId && <span className="text-[11px] text-text-subtle">직접 추가</span>}
                </span>
                <span className="tabular block text-[12px] text-text-muted">
                  {amountLabel(i.grams, getFood(i.foodId))} · 단백질 {fmtG(i.proteinG)}
                </span>
              </span>
              <span className="tabular text-[13px] text-text-muted">{i.kcal}kcal</span>
            </li>
          ))}
        </ul>
        <div className="flex justify-end gap-1 border-t border-border px-2 py-1.5">
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
      </section>
    )
  }

  return (
    <>
      <PageHeader title="오늘의 식단" description={new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' })} back="/record" actions={!isNewUser() ? <MockBadge /> : undefined} />
      <div className="space-y-5 md:max-w-2xl">
        {/* 오늘 섭취 */}
        <Card className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <p className="text-[13px] text-text-muted">오늘 섭취 열량</p>
            <button type="button" onClick={() => setGoalOpen(true)} className="rounded-full bg-surface-muted px-3 py-1 text-[12px] font-semibold text-text hover:bg-border">
              {goals.kcal ? '목표 수정' : '목표 설정하기'}
            </button>
          </div>
          <div className="flex items-end justify-between gap-3">
            <p className="tabular">
              <span className="text-[34px] leading-none font-bold">{today.kcal.toLocaleString()}</span>
              <span className="ml-1 text-[16px] font-semibold text-text-muted">kcal</span>
            </p>
            <p className="tabular text-right text-[13px] text-text-muted">{goals.kcal ? `목표 ${goals.kcal.toLocaleString()}kcal · ${kcalPct}%` : '목표 미설정'}</p>
          </div>
          {goals.kcal && (
            <div className="h-1.5 overflow-hidden rounded-full bg-border" role="meter" aria-label="열량 목표 대비" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(kcalPct ?? 0, 100)}>
              <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(kcalPct ?? 0, 100)}%` }} />
            </div>
          )}
          <dl className="grid grid-cols-3 gap-2 border-t border-border pt-4">
            {MACRO_META.map((m) => (
              <div key={m.key}>
                <dt className="flex items-center gap-1.5 text-[12px] text-text-muted">
                  <span aria-hidden className="size-2 rounded-full" style={{ background: m.color }} />
                  {m.label}
                </dt>
                <dd className="tabular mt-0.5 text-[18px] font-bold">
                  {Math.round(today[m.key])}g{goals[m.key] ? <span className="text-[12px] font-medium text-text-muted"> / {goals[m.key]}g</span> : null}
                </dd>
              </div>
            ))}
          </dl>
        </Card>

        {/* 식사 기록 */}
        <section aria-labelledby="meals-today" className="space-y-2.5">
          <div className="flex items-baseline justify-between px-1">
            <h2 id="meals-today" className="text-[17px] font-bold">
              식사 기록
            </h2>
            <span className="text-[13px] text-text-muted">{todays.length}건 기록</span>
          </div>
          {MEAL_ORDER.map((type) => {
            const list = todays.filter((r) => r.mealType === type).sort((a, b) => a.eatenAt.localeCompare(b.eatenAt))
            const kcal = sumNutrients(list.flatMap((r) => r.items)).kcal
            const { icon: Icon, color } = MEAL_ICON[type]
            return (
              <Card key={type} className="space-y-3 p-4">
                <div className="flex items-center gap-3">
                  <span aria-hidden className="inline-flex size-12 shrink-0 items-center justify-center rounded-2xl bg-surface-muted" style={{ color }}>
                    <Icon size={22} strokeWidth={1.75} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[16px] font-bold">{TYPE_LABEL[type]}</p>
                    <p className="tabular truncate text-[13px] text-text-muted">
                      {list.length ? `${list.flatMap((r) => r.items.map((i) => i.name)).join(' · ')} · ${kcal.toLocaleString()}kcal` : '아직 기록이 없어요'}
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label={`${TYPE_LABEL[type]} 추가`}
                    onClick={() => startNew(type)}
                    className="inline-flex size-11 shrink-0 items-center justify-center rounded-full border border-border text-icon hover:bg-surface-muted"
                  >
                    <Plus size={20} aria-hidden />
                  </button>
                </div>
                {list.length > 0 && <div className="space-y-2">{list.map((r) => recordCard(r, true))}</div>}
              </Card>
            )
          })}
        </section>

        {/* 지난 기록 */}
        {pastDays.length > 0 && (
          <section aria-labelledby="meals-past" className="space-y-3">
            <h2 id="meals-past" className="px-1 text-[17px] font-bold">
              지난 기록
            </h2>
            {pastDays.map((day) => (
              <div key={day} className="space-y-2">
                <h3 className="px-1 text-[13px] font-semibold text-text-muted">{day}</h3>
                {sorted.filter((r) => dayLabel(r.eatenAt) === day).map((r) => recordCard(r))}
              </div>
            ))}
          </section>
        )}
      </div>
      <NutritionGoalSheet
        open={goalOpen}
        onClose={() => setGoalOpen(false)}
        onManual={() => {
          setGoalOpen(false)
          navigate('/my/goals')
        }}
      />
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
