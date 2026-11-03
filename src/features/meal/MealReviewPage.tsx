import { Camera, Check, Pencil, Plus, Search, SlidersHorizontal, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { toast } from 'sonner'

import { AppIcon } from '@/components/common/AppIcon'
import { BottomSheet } from '@/components/common/BottomSheet'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { MockBadge } from '@/components/common/MockBadge'
import { PageHeader } from '@/components/common/PageHeader'
import { EmptyState } from '@/components/common/StateViews'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { localInputToIso, toDateTimeLocalValue } from '@/lib/date'
import { amountLabel, fmtG, sumNutrients } from '@/lib/nutrition'
import { cn } from '@/lib/utils'
import { apiReady } from '@/lib/api'
import { dbErrorMessage, isLive } from '@/lib/supabase'
import { confirmPhotoMeal } from '@/services/live/meals'
import { getFood } from '@/services/foodCatalog'
import { makeItem, useMealStore } from '@/stores/mealStore'
import { isPhotoItem, useMealDraftStore, type DraftItem } from '@/stores/mealDraftStore'
import type { MealType } from '@/types/domain'
import type { FoodItem, MealItem } from '@/types/meal'

import { AmountSheet, CustomFoodForm, FoodSearchPanel, NutritionGrid } from './mealParts'
import { SampleMealArt } from './SampleMealArt'

const MEAL_TYPES: { value: MealType; label: string }[] = [
  { value: 'breakfast', label: '아침' },
  { value: 'lunch', label: '점심' },
  { value: 'dinner', label: '저녁' },
  { value: 'snack', label: '간식' },
]

/** 음식 교체 시트 — 검색해서 고르거나, 없으면 직접 등록 */
function ReplaceSheet({ open, onClose, onPick, title }: { open: boolean; onClose: () => void; onPick: (f: FoodItem) => void; title: string }) {
  const [custom, setCustom] = useState<string | null>(null)
  return (
    <BottomSheet
      open={open}
      onRequestClose={() => {
        setCustom(null)
        onClose()
      }}
      title={custom !== null ? '직접 음식 등록' : title}
      description={custom !== null ? '영양 성분표를 보고 입력해 주세요' : '고른 음식의 이름과 영양 정보로 바뀌어요'}
    >
      {custom !== null ? (
        <CustomFoodForm
          initialName={custom}
          onSaved={(f) => {
            setCustom(null)
            onPick(f)
          }}
        />
      ) : (
        <FoodSearchPanel autoFocus onPick={onPick} onCreateCustom={(n) => setCustom(n)} />
      )}
    </BottomSheet>
  )
}

/** 식단 작성·저장 — 사진 기록과 수동 기록이 같은 화면을 쓴다 */
export function MealReviewPage() {
  const navigate = useNavigate()
  const d = useMealDraftStore()
  const { addRecord, updateRecord } = useMealStore()
  useMealStore((s) => s.customFoods)
  const [adding, setAdding] = useState(false)
  const [amountFor, setAmountFor] = useState<DraftItem | null>(null)
  const [replaceFor, setReplaceFor] = useState<DraftItem | null>(null)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [openedAt] = useState(() => Date.now())

  const resolved = d.items.filter((i) => i.foodId)
  const totals = sumNutrients(resolved)
  const unresolved = d.items.length - resolved.length
  const future = new Date(d.eatenAt).getTime() > openedAt + 60_000
  const canSave = d.items.length > 0 && unresolved === 0 && !future
  const typeLabel = MEAL_TYPES.find((t) => t.value === d.mealType)!.label
  const photoItems = d.items.filter(isPhotoItem).length
  const mockAi = d.items.some((i) => i.ai?.mode === 'mock')
  const reviewNo = (it: DraftItem) => d.items.filter((x) => x.ai?.status === 'review').indexOf(it) + 1

  const choose = (item: DraftItem, food: FoodItem) => {
    const corrected = !!item.ai && item.ai.candidates[0] !== food.id
    d.replaceItem(item.id, { ...makeItem(food, food.servingGrams, { fromPhoto: isPhotoItem(item), ai: item.ai, corrected }), id: item.id })
  }

  const [saving, setSaving] = useState(false)
  const save = async () => {
    const items = d.items as MealItem[]
    const base = { mealType: d.mealType, eatenAt: localInputToIso(d.eatenAt), source: (d.photoId && photoItems ? 'photo' : 'manual') as 'photo' | 'manual', photoId: photoItems ? (d.photoId ?? undefined) : undefined, items }
    if (apiReady && !d.editingId && base.source === 'photo' && d.photoId) {
      // 실서비스 사진 기록: 서버가 만든 초안(meal_id = photoId)을 확정하고 인식 결과마다 수락·수정·제외를 남긴다
      setSaving(true)
      try {
        const rec = { ...base, id: d.photoId }
        await confirmPhotoMeal(rec, d.predIds)
        useMealStore.setState((s) => ({ records: [...s.records, rec] }))
      } catch (e) {
        setSaving(false)
        return void toast.error('식단을 저장하지 못했어요', { description: dbErrorMessage(e) })
      }
      setSaving(false)
    } else if (d.editingId) updateRecord({ ...base, id: d.editingId })
    else addRecord(base)
    toast.success(`${typeLabel} 식단을 ${d.editingId ? '수정' : '저장'}했어요`, { description: isLive ? undefined : '목업 · 이 기기 화면에만 저장돼요.' })
    d.reset()
    navigate('/record/meal')
  }

  return (
    <>
      <PageHeader
        title={d.editingId ? '식단 수정' : '오늘의 식단'}
        description={`${new Date(d.eatenAt).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' })} · ${d.editingId ? '기록 수정 중' : '식단 작성 중'}`}
        back="/record/meal/new"
        actions={isLive ? undefined : <MockBadge label="예시 목업" />}
      />
      <div className="space-y-5 pb-44 md:max-w-lg">
        {/* 끼니 · 시간 */}
        <div role="radiogroup" aria-label="끼니" className="grid grid-cols-4 gap-1 rounded-2xl bg-surface-muted p-1">
          {MEAL_TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              role="radio"
              aria-checked={d.mealType === t.value}
              onClick={() => d.setMeta({ mealType: t.value })}
              className={cn('h-10 rounded-xl text-[15px] font-medium', d.mealType === t.value ? 'bg-surface font-semibold text-text shadow-[0_1px_2px_rgba(15,23,42,0.08)]' : 'text-text-muted')}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div>
          <label htmlFor="eatenAt" className="mb-1.5 block text-[13px] font-medium text-text-muted">
            식사 날짜 · 시간
          </label>
          <Input id="eatenAt" type="datetime-local" value={d.eatenAt} max={toDateTimeLocalValue(new Date())} aria-invalid={future} onChange={(e) => d.setMeta({ eatenAt: e.target.value })} />
          {future && <p className="mt-1.5 text-[13px] text-danger">아직 지나지 않은 시간이에요.</p>}
        </div>

        {/* 사진 */}
        {d.photo && photoItems > 0 && (
          <div>
            <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl">
              {d.photo.kind === 'file' ? <img src={d.photo.url} alt="식사 사진" className="h-full w-full object-cover" /> : <SampleMealArt className="h-full w-full" />}
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="flex items-center gap-2 text-[14px] font-semibold">
                <AppIcon icon={Camera} size="sm" tone="muted" /> 식단 사진 1장
              </span>
              {!d.editingId && (
                <Button asChild variant="outline" size="sm" className="h-9 rounded-full">
                  <Link to="/record/meal/photo">다시 인식</Link>
                </Button>
              )}
            </div>
          </div>
        )}

        {/* 기록할 음식 */}
        <section aria-labelledby="items-title">
          <div className="mb-2 flex items-baseline justify-between">
            <h2 id="items-title" className="text-[18px] font-bold">
              기록할 음식
            </h2>
            <span className="text-[13px] text-text-muted">{d.items.length}개 음식</span>
          </div>
          {mockAi && (
            <p className="mb-2 rounded-xl bg-review-soft px-3 py-2 text-[12px] leading-relaxed text-review">
              <b>목업 인식 결과</b>예요. 실제 AI가 사진을 분석한 결과가 아니라 시연용 고정 예시예요.
            </p>
          )}
          {d.items.length === 0 && <EmptyState title="아직 담은 음식이 없어요" description="사진으로 분석하거나 직접 추가해 보세요." className="py-6" />}
          <ul className="space-y-2.5">
            {d.items.map((it) => {
              const food = getFood(it.foodId)
              const ai = it.ai
              return (
                <li key={it.id} className={cn('rounded-2xl border bg-surface p-4', !it.foodId ? 'border-review-border' : 'border-border')}>
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      {ai && (
                        <Badge tone={it.foodId ? 'info' : 'review'} className="mb-1">
                          {ai.status === 'recognized' ? '인식 결과' : it.foodId ? '확인 완료' : '확인 필요'}
                        </Badge>
                      )}
                      <p className="truncate text-[17px] font-bold">{it.foodId ? it.name : '이 음식이 맞나요?'}</p>
                      <p className="tabular text-[13px] text-text-muted">
                        {isPhotoItem(it) ? '사진 인식' : '직접 검색'}
                        {it.foodId && ` · ${amountLabel(it.grams, food)} · ${it.kcal}kcal`}
                        {it.corrected && ' · 직접 고침'}
                      </p>
                    </div>
                    {it.foodId && (
                      <>
                        <Button variant="outline" size="sm" className="h-9 rounded-full px-3" onClick={() => setReplaceFor(it)} aria-label={`${it.name} 음식 수정`}>
                          <Pencil size={14} strokeWidth={1.75} aria-hidden /> 수정
                        </Button>
                      </>
                    )}
                    <button type="button" onClick={() => d.removeItem(it.id)} aria-label={`${it.foodId ? it.name : `확인 필요 ${reviewNo(it)}`} 제외`} className="inline-flex size-9 shrink-0 items-center justify-center rounded-full hover:bg-surface-muted">
                      <AppIcon icon={Trash2} size="sm" tone="muted" className="size-[18px]" />
                    </button>
                  </div>

                  {/* AI 후보 */}
                  {ai && (ai.candidates.length > 0 || !it.foodId) && (
                    <div className="mt-3">
                      {!it.foodId &&
                        (ai.candidates.some((cid) => getFood(cid)) ? (
                          <p className="mb-2 text-[13px] text-review">사진에 있다면 맞는 음식을 골라 주세요. 없으면 빼면 돼요.</p>
                        ) : (
                          <p className="mb-2 text-[13px] text-review">후보가 없어요. 검색해서 골라 주세요.</p>
                        ))}
                      {ai.candidates.some((cid) => getFood(cid)) && (
                        <div role="radiogroup" aria-label={`${it.foodId ? it.name : `확인 필요 ${reviewNo(it)}`} 인식 후보`} className="flex flex-wrap gap-1.5">
                          {ai.candidates.map((cid) => {
                            const c = getFood(cid)
                            if (!c) return null // 음식 DB 에 없는 후보는 보여주지 않음 (검색으로 고르기)
                            const active = it.foodId === cid
                            return (
                              <button
                                key={cid}
                                type="button"
                                role="radio"
                                aria-checked={active}
                                onClick={() => choose(it, c)}
                                className={cn('inline-flex h-9 items-center gap-1 rounded-full border px-3 text-[13px]', active ? 'border-primary bg-primary-soft font-semibold text-primary' : 'border-border bg-surface hover:bg-surface-muted')}
                              >
                                {active && <Check size={14} strokeWidth={2.25} aria-hidden />}
                                {c.name}
                              </button>
                            )
                          })}
                        </div>
                      )}
                      {!it.foodId && (
                        <Button variant="secondary" size="sm" className="mt-2 h-9" onClick={() => setReplaceFor(it)}>
                          <Search size={15} strokeWidth={1.75} aria-hidden /> 검색해서 고르기
                        </Button>
                      )}
                    </div>
                  )}

                  {it.foodId && (
                    <div className="mt-3 flex items-center gap-2">
                      <p className="tabular flex-1 text-[12px] text-text-muted">
                        탄 {fmtG(it.carbG)} · 단 {fmtG(it.proteinG)} · 지 {fmtG(it.fatG)}
                      </p>
                      <Button variant="ghost" size="sm" className="h-9" onClick={() => setAmountFor(it)} aria-label={`${it.name} 섭취량 수정`}>
                        <SlidersHorizontal size={15} strokeWidth={1.75} aria-hidden /> 섭취량
                      </Button>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>

          {/* 음식 직접 추가 (펼침) */}
          {!adding ? (
            <Button variant="outline" size="lg" className="mt-3 w-full rounded-2xl" onClick={() => setAdding(true)}>
              <Plus size={18} strokeWidth={1.75} aria-hidden /> 음식 직접 추가하기
            </Button>
          ) : (
            <div className="mt-3 rounded-2xl bg-surface-muted p-3">
              <div className="mb-2 flex items-center justify-between px-1">
                <p className="text-[14px] font-semibold">음식 직접 추가</p>
                <button type="button" onClick={() => setAdding(false)} aria-label="추가 닫기" className="inline-flex size-9 items-center justify-center rounded-full hover:bg-surface">
                  <X size={18} strokeWidth={1.75} aria-hidden />
                </button>
              </div>
              <div className="rounded-xl bg-surface p-3">
                <FoodSearchPanel
                  autoFocus
                  compact
                  onPick={(f) => navigate(`/record/meal/food/${f.id}`)}
                  onQuickAdd={(f) => {
                    d.addItems([makeItem(f, f.servingGrams)])
                    toast.success(`${f.name} 1인분을 담았어요`)
                  }}
                  onCreateCustom={(n) => navigate(`/record/meal/custom?name=${encodeURIComponent(n)}`)}
                />
              </div>
            </div>
          )}
        </section>

        <NutritionGrid n={totals} big />
        {unresolved > 0 && <p className="-mt-3 text-[13px] text-review">음식을 고르지 않은 항목 {unresolved}개가 있어요. 골라야 저장할 수 있어요.</p>}

        {d.items.length > 0 && (
          <button type="button" onClick={() => setConfirmCancel(true)} className="w-full text-center text-[13px] text-text-muted underline-offset-2 hover:underline">
            작성 중인 식단 비우기
          </button>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 border-t border-border bg-surface/95 px-5 py-3 backdrop-blur md:bottom-0 md:left-20 lg:left-60">
        <div className="mx-auto flex max-w-lg items-center gap-3">
          <p className="tabular min-w-0 flex-1 truncate text-[13px] text-text-muted">
            합계 <b className="text-[16px] text-text">{totals.kcal.toLocaleString()}kcal</b>
          </p>
          <Button size="lg" disabled={!canSave || saving} onClick={save}>
            <Check size={18} strokeWidth={2} aria-hidden /> {typeLabel} 식단 {d.editingId ? '수정' : '저장'}하기
          </Button>
        </div>
      </div>

      <AmountSheet
        key={amountFor?.id}
        food={getFood(amountFor?.foodId)}
        grams={amountFor?.grams ?? 0}
        open={!!amountFor}
        onClose={() => setAmountFor(null)}
        onApply={(g) => {
          const f = getFood(amountFor!.foodId)!
          d.replaceItem(amountFor!.id, { ...makeItem(f, g, { fromPhoto: isPhotoItem(amountFor!), ai: amountFor!.ai, corrected: amountFor!.corrected }), id: amountFor!.id })
          setAmountFor(null)
        }}
      />
      <ReplaceSheet
        key={replaceFor?.id}
        open={!!replaceFor}
        title={replaceFor?.foodId ? `${replaceFor.name} 대신 고르기` : '음식 검색'}
        onClose={() => setReplaceFor(null)}
        onPick={(f) => {
          choose(replaceFor!, f)
          setReplaceFor(null)
        }}
      />
      <ConfirmDialog
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        title="작성 중인 식단을 비울까요?"
        description="담은 음식과 사진이 모두 사라져요."
        confirmLabel="비우기"
        tone="danger"
        onConfirm={() => {
          d.reset()
          navigate('/record/meal')
        }}
      />
    </>
  )
}
