import { Camera, ImagePlus, LoaderCircle, Plus, Search, Trash2, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'

import { AppIcon } from '@/components/common/AppIcon'
import { ChipGroup } from '@/components/common/ChipGroup'
import { MockBadge } from '@/components/common/MockBadge'
import { Notice } from '@/components/common/Notice'
import { PageHeader } from '@/components/common/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { foodById } from '@/fixtures/foods.mock'
import { cn } from '@/lib/utils'
import { classifyRegions, type RegionPrediction } from '@/services/mealAi'
import { useMealStore } from '@/stores/mealStore'
import type { MealType } from '@/types/domain'

import { FoodSearchSheet } from './FoodSearchSheet'
import { SAMPLE_REGIONS, SampleMealArt } from './SampleMealArt'

interface Region {
  x: number
  y: number
  w: number
  h: number
}
type Servings = '0.5' | '1' | '1.5'
interface Item {
  key: string
  regionIndex: number | null
  prediction: RegionPrediction | null
  foodId: string | null
  servings: Servings
}
type Stage = 'pick' | 'regions' | 'analyzing' | 'results'

const MEAL_TYPES: { value: MealType; label: string }[] = [
  { value: 'breakfast', label: '아침' },
  { value: 'lunch', label: '점심' },
  { value: 'dinner', label: '저녁' },
  { value: 'snack', label: '간식' },
]
const defaultMealType = (): MealType => {
  const h = new Date().getHours()
  return h < 10 ? 'breakfast' : h < 15 ? 'lunch' : h < 21 ? 'dinner' : 'snack'
}
const nutrition = (foodId: string, servings: Servings) => {
  const f = foodById(foodId)
  const k = Number(servings)
  return { kcal: Math.round(f.kcal * k), proteinG: Math.round(f.proteinG * k), carbG: Math.round(f.carbG * k), fatG: Math.round(f.fatG * k) }
}
let keySeq = 0

/** 사진 위 영역 표시 (번호 배지) */
function RegionBoxes({ regions, onRemove, small }: { regions: Region[]; onRemove?: (i: number) => void; small?: boolean }) {
  return (
    <>
      {regions.map((r, i) => (
        <div
          key={i}
          className="absolute rounded-lg border-2 border-white shadow-[0_0_0_1.5px_rgba(15,23,42,0.55)]"
          style={{ left: `${r.x}%`, top: `${r.y}%`, width: `${r.w}%`, height: `${r.h}%` }}
        >
          <span className={cn('absolute -top-2 -left-2 inline-flex items-center justify-center rounded-full bg-text font-bold text-surface', small ? 'size-5 text-[11px]' : 'size-7 text-[13px]')}>
            {i + 1}
          </span>
          {onRemove && (
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => onRemove(i)}
              aria-label={`${i + 1}번 영역 지우기`}
              className="absolute top-1 right-1 inline-flex size-7 items-center justify-center rounded-full bg-surface/95 shadow"
            >
              <X size={16} strokeWidth={2} aria-hidden />
            </button>
          )}
        </div>
      ))}
    </>
  )
}

export function MealPhotoPage() {
  const navigate = useNavigate()
  const addMeals = useMealStore((s) => s.addMeals)
  const [stage, setStage] = useState<Stage>('pick')
  const [photo, setPhoto] = useState<{ kind: 'sample' } | { kind: 'file'; url: string } | null>(null)
  const [regions, setRegions] = useState<Region[]>([])
  const [draft, setDraft] = useState<Region | null>(null)
  const [items, setItems] = useState<Item[]>([])
  const [mealType, setMealType] = useState<MealType>(defaultMealType)
  const [search, setSearch] = useState<{ open: boolean; forKey: string | null }>({ open: false, forKey: null })
  const canvas = useRef<HTMLDivElement>(null)
  const start = useRef<{ x: number; y: number } | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const pct = (e: React.PointerEvent) => {
    const r = canvas.current!.getBoundingClientRect()
    return { x: Math.min(100, Math.max(0, ((e.clientX - r.left) / r.width) * 100)), y: Math.min(100, Math.max(0, ((e.clientY - r.top) / r.height) * 100)) }
  }
  const rectOf = (a: { x: number; y: number }, b: { x: number; y: number }): Region => ({ x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) })

  const analyze = async (rs: Region[]) => {
    setRegions(rs)
    setStage('analyzing')
    const preds = await classifyRegions(rs.length)
    setItems(
      preds.map((p, i) => ({ key: `i${keySeq++}`, regionIndex: i, prediction: p, foodId: p.confident ? p.candidates[0] : null, servings: '1' })),
    )
    setStage('results')
  }

  const patchItem = (key: string, patch: Partial<Item>) => setItems((list) => list.map((it) => (it.key === key ? { ...it, ...patch } : it)))
  const ready = items.length > 0 && items.every((i) => i.foodId)
  const total = items.reduce(
    (a, i) => {
      if (!i.foodId) return a
      const n = nutrition(i.foodId, i.servings)
      return { kcal: a.kcal + n.kcal, proteinG: a.proteinG + n.proteinG }
    },
    { kcal: 0, proteinG: 0 },
  )

  const save = () => {
    const group = `photo-${Date.now()}`
    addMeals(
      items.map((i) => {
        const f = foodById(i.foodId!)
        const n = nutrition(i.foodId!, i.servings)
        return {
          mealType,
          eatenAt: new Date().toISOString(),
          foodName: f.name,
          servings: Number(i.servings),
          ...n,
          sodiumMg: 0,
          photoGroupId: photo ? group : undefined,
          corrected: !!i.prediction && i.prediction.candidates[0] !== i.foodId,
        }
      }),
    )
    toast.success(`목업: ${items.length}가지 음식을 기록했어요`, { description: '화면에만 저장되고 서버로 보내지 않아요.' })
    navigate('/record/meal')
  }

  const photoView = (className?: string) =>
    photo?.kind === 'file' ? (
      <img src={photo.url} alt="고른 식사 사진" className={cn('h-full w-full object-cover', className)} draggable={false} />
    ) : (
      <SampleMealArt className={cn('h-full w-full', className)} />
    )

  return (
    <>
      <PageHeader title="식단 기록하기" back="/record/meal" actions={<MockBadge label="목업 · 실제 AI 아님" />} />

      {stage === 'pick' && (
        <div className="space-y-3 md:max-w-lg">
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            aria-label="식사 사진 고르기"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (!f) return
              setPhoto({ kind: 'file', url: URL.createObjectURL(f) })
              setStage('regions')
            }}
          />
          <button type="button" onClick={() => fileInput.current?.click()} className="flex w-full items-center gap-4 rounded-3xl border-2 border-dashed border-border bg-surface p-6 text-left hover:bg-surface-muted/60">
            <AppIcon icon={Camera} size="lg" bg="soft" className="size-14 rounded-2xl" />
            <span>
              <span className="block text-[17px] font-bold">사진 찍기 · 고르기</span>
              <span className="mt-0.5 block text-[13px] text-text-muted">한 상 차림도 괜찮아요. 음식마다 영역을 지정해요.</span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              setPhoto({ kind: 'sample' })
              setStage('regions')
            }}
            className="flex w-full items-center gap-4 rounded-3xl border border-border bg-surface p-5 text-left hover:bg-surface-muted/60"
          >
            <AppIcon icon={ImagePlus} size="md" bg="neutral" tone="muted" className="size-12 rounded-2xl" />
            <span>
              <span className="block text-[15px] font-semibold">예시 한 상 차림으로 체험</span>
              <span className="block text-[13px] text-text-muted">찌개 · 밥 · 반찬 3가지 그림</span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              setPhoto(null)
              setItems([])
              setStage('results')
              setSearch({ open: true, forKey: null })
            }}
            className="flex w-full items-center gap-4 rounded-3xl border border-border bg-surface p-5 text-left hover:bg-surface-muted/60"
          >
            <AppIcon icon={Search} size="md" bg="neutral" tone="muted" className="size-12 rounded-2xl" />
            <span>
              <span className="block text-[15px] font-semibold">사진 없이 검색해서 기록</span>
              <span className="block text-[13px] text-text-muted">음식 이름으로 찾아요</span>
            </span>
          </button>
          <Notice>지금은 학습한 20종(밥·국·찌개·반찬 포함) 안에서만 인식해요. 영양 정보는 식약처 DB 대표 1인분 기준이에요.</Notice>
        </div>
      )}

      {(stage === 'regions' || stage === 'analyzing') && photo && (
        <div className="space-y-4 md:max-w-lg">
          <div>
            <p className="text-[17px] font-bold">음식마다 네모를 그려 주세요</p>
            <p className="mt-1 text-[13px] leading-relaxed text-text-muted">한 그릇에 하나씩 그리면 각각 인식해요. 잘못 그렸으면 X로 지워요.</p>
          </div>
          <div
            ref={canvas}
            className={cn('relative aspect-[4/3] w-full max-w-full overflow-hidden rounded-2xl bg-surface-muted select-none', stage === 'regions' && 'touch-none cursor-crosshair')}
            onPointerDown={(e) => {
              if (stage !== 'regions') return
              ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
              start.current = pct(e)
              setDraft({ ...start.current, w: 0, h: 0 })
            }}
            onPointerMove={(e) => start.current && setDraft(rectOf(start.current, pct(e)))}
            onPointerUp={(e) => {
              if (!start.current) return
              const r = rectOf(start.current, pct(e))
              start.current = null
              setDraft(null)
              if (r.w > 6 && r.h > 6 && regions.length < 8) setRegions((rs) => [...rs, r])
            }}
            role="application"
            aria-label="식사 사진. 끌어서 음식 영역을 그려요"
          >
            {photoView()}
            <RegionBoxes regions={regions} onRemove={stage === 'regions' ? (i) => setRegions((rs) => rs.filter((_, j) => j !== i)) : undefined} />
            {draft && <div className="absolute rounded-lg border-2 border-dashed border-white bg-white/15" style={{ left: `${draft.x}%`, top: `${draft.y}%`, width: `${draft.w}%`, height: `${draft.h}%` }} />}
            {stage === 'analyzing' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-900/45 text-white" role="status">
                <LoaderCircle size={32} strokeWidth={1.75} className="animate-spin" aria-hidden />
                <p className="text-[15px] font-semibold">{regions.length}개 영역을 인식하고 있어요</p>
              </div>
            )}
          </div>
          {stage === 'regions' && (
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
                  {regions.length ? `${regions.length}개 인식하기` : '영역을 그려 주세요'}
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {stage === 'results' && (
        <div className="space-y-4 pb-36 md:max-w-lg">
          {photo && (
            <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl">
              {photoView()}
              <RegionBoxes regions={regions} small />
            </div>
          )}
          <div className="flex items-center justify-between">
            <h2 className="text-[17px] font-bold">{items.length ? `음식 ${items.length}가지` : '기록할 음식'}</h2>
            <Button variant="ghost" size="sm" onClick={() => setSearch({ open: true, forKey: null })}>
              <Plus size={16} strokeWidth={1.75} aria-hidden /> 음식 추가
            </Button>
          </div>

          {items.length === 0 && <p className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-[14px] text-text-muted">음식을 추가해 주세요.</p>}

          <ul className="space-y-3">
            {items.map((it, n) => {
              const p = it.prediction
              const food = it.foodId ? foodById(it.foodId) : null
              const nu = it.foodId ? nutrition(it.foodId, it.servings) : null
              return (
                <li key={it.key}>
                  <Card className="space-y-3 p-4">
                    <div className="flex items-center gap-2">
                      {it.regionIndex !== null && (
                        <span className="inline-flex size-6 items-center justify-center rounded-full bg-text text-[12px] font-bold text-surface">{it.regionIndex + 1}</span>
                      )}
                      <p className="flex-1 text-[17px] font-bold">{food?.name ?? '어떤 음식인가요?'}</p>
                      {p && (p.confident ? <Badge tone="success">확신 높음</Badge> : <Badge tone="review">후보 중 골라 주세요</Badge>)}
                      {!p && <Badge>직접 추가</Badge>}
                      <button type="button" onClick={() => setItems((l) => l.filter((x) => x.key !== it.key))} aria-label={`${n + 1}번째 음식 빼기`} className="inline-flex size-9 items-center justify-center rounded-full hover:bg-surface-muted">
                        <AppIcon icon={Trash2} size="sm" tone="muted" className="size-[18px]" />
                      </button>
                    </div>

                    {p && (
                      <div>
                        <p className="mb-1.5 text-[12px] text-text-muted">{p.confident ? '다른 음식이면 고쳐 주세요' : '비슷한 음식이 있어요'}</p>
                        <ChipGroup
                          label={`${n + 1}번째 음식 후보`}
                          options={p.candidates.map((id) => ({ value: id, label: foodById(id).name }))}
                          value={it.foodId}
                          onChange={(v) => patchItem(it.key, { foodId: v })}
                        />
                        <button type="button" onClick={() => setSearch({ open: true, forKey: it.key })} className="mt-1.5 text-[13px] font-medium text-text-muted underline-offset-2 hover:underline">
                          목록에 없으면 직접 검색
                        </button>
                      </div>
                    )}

                    {food && (
                      <>
                        <ChipGroup
                          label={`${food.name} 먹은 양`}
                          columns={3}
                          options={[
                            { value: '0.5', label: '0.5인분' },
                            { value: '1', label: '1인분' },
                            { value: '1.5', label: '1.5인분' },
                          ]}
                          value={it.servings}
                          onChange={(v) => patchItem(it.key, { servings: v })}
                        />
                        <p className="tabular rounded-xl bg-surface-muted px-3 py-2 text-[13px] text-text-muted">
                          <b className="text-text">{nu!.kcal}kcal</b> · 단백질 {nu!.proteinG}g · 탄수 {nu!.carbG}g · 지방 {nu!.fatG}g
                        </p>
                      </>
                    )}
                  </Card>
                </li>
              )
            })}
          </ul>
          {items.some((i) => i.prediction) && (
            <p className="text-[12px] leading-relaxed text-text-subtle">고른 결과는 ‘수정 기록’으로 저장되어 모델 성능 점검에 쓰여요 (동의한 경우). 영양 값은 예시 값이에요.</p>
          )}

          <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 border-t border-border bg-surface/95 px-5 py-3 backdrop-blur md:bottom-0 md:left-20 lg:left-60">
            <div className="mx-auto max-w-lg space-y-2">
              <ChipGroup label="끼니" columns={4} options={MEAL_TYPES} value={mealType} onChange={setMealType} className="grid-cols-4 [&_button]:h-9 [&_button]:px-1" />
              <div className="flex items-center gap-3">
                <p className="tabular flex-1 text-[13px] text-text-muted">
                  합계 <b className="text-[17px] text-text">{total.kcal.toLocaleString()}kcal</b> · 단백질 {total.proteinG}g
                </p>
                <Button size="lg" disabled={!ready} onClick={save}>
                  기록하기
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <FoodSearchSheet
        open={search.open}
        onClose={() => setSearch({ open: false, forKey: null })}
        onPick={(id) => {
          if (search.forKey) patchItem(search.forKey, { foodId: id })
          else setItems((l) => [...l, { key: `i${keySeq++}`, regionIndex: null, prediction: null, foodId: id, servings: '1' }])
          setSearch({ open: false, forKey: null })
        }}
      />
    </>
  )
}
