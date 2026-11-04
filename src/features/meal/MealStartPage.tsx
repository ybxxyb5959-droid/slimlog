import { clearCaptureFiles, isNativeApp } from '@/lib/native'
import { Camera, ChevronRight, Image as ImageIcon, Search, Sparkles, Star } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { toast } from 'sonner'

import { AppIcon } from '@/components/common/AppIcon'
import { PageHeader } from '@/components/common/PageHeader'
import { fmtG, nutrientsFor, sumNutrients } from '@/lib/nutrition'
import { apiReady, wakeServer } from '@/lib/api'
import { isLive } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { publicFoodCount } from '@/services/live/meals'
import { getFood, recentFoods } from '@/services/foodCatalog'
import { useMealDraftStore } from '@/stores/mealDraftStore'
import { useMealStore } from '@/stores/mealStore'

/** 식단 기록 시작 — 사진 / 직접 검색 / 최근·즐겨찾기 */
export function MealStartPage() {
  // 무료 서버(Render)가 잠들어 있으면 미리 깨워 둔다
  useEffect(() => wakeServer(), [])
  const navigate = useNavigate()
  const draft = useMealDraftStore()
  const favorites = useMealStore((s) => s.favorites)
  useMealStore((s) => s.records)
  const [tab, setTab] = useState<'recent' | 'fav'>('recent')
  const camera = useRef<HTMLInputElement>(null)
  const gallery = useRef<HTMLInputElement>(null)
  const recents = recentFoods()
  const favFoods = favorites.map((id) => getFood(id)).filter((f) => !!f)
  const pending = draft.items.length > 0
  const [publicFoods, setPublicFoods] = useState<number | null>(null)
  useEffect(() => {
    if (isLive) publicFoodCount().then(setPublicFoods).catch(() => setPublicFoods(null))
  }, [])
  const pendingKcal = sumNutrients(draft.items.filter((i) => i.foodId)).kcal

  const startPhoto = (p: { kind: 'sample' } | { kind: 'file'; url: string; file: File }) => {
    if (draft.editingId) draft.reset()
    draft.setPhoto(p)
    navigate('/record/meal/photo')
  }
  const pickSource = (id: 'camera' | 'gallery' | 'sample') => {
    // 실서비스: 사진 기록은 서버가 EXIF 제거·저장·인식까지 해야 해서 서버 연결 전에는 막는다 (목업 결과로 실제 기록을 만들지 않음)
    if (isLive && !apiReady) return void toast('사진 인식은 서버 연결 후 열려요', { description: '지금은 직접 검색해서 기록해 주세요.' })
    if (isLive && id === 'sample') return void toast('예시 사진은 목업 모드에서만 쓸 수 있어요', { description: '카메라나 갤러리에서 실제 사진을 골라 주세요.' })
    if (id === 'camera') camera.current?.click()
    else if (id === 'gallery') gallery.current?.click()
    else startPhoto({ kind: 'sample' })
  }
  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0]
    e.target.value = ''
    if (!picked) return
    // 갤럭시 앱: 촬영 임시 파일을 메모리로 옮긴 뒤 바로 지운다 (평문 사진이 기기에 남지 않게). 웹에서는 그대로
    const f = isNativeApp() ? new File([await picked.arrayBuffer()], picked.name, { type: picked.type || 'image/jpeg' }) : picked
    void clearCaptureFiles()
    startPhoto({ kind: 'file', url: URL.createObjectURL(f), file: f })
  }

  return (
    <>
      <PageHeader title="오늘 무엇을 드셨나요?" description="사진으로 간편하게 기록하거나 직접 검색해보세요." back="/record/meal" />
      <div className="space-y-6 pb-24 md:max-w-lg">
        {/* A. 사진 */}
        <section aria-labelledby="sec-photo">
          <h2 id="sec-photo" className="mb-2 text-[15px] font-bold">
            사진으로 기록하기
          </h2>
          <input ref={camera} type="file" accept="image/*" capture="environment" className="sr-only" aria-label="카메라로 촬영" onChange={onFile} />
          <input ref={gallery} type="file" accept="image/*" className="sr-only" aria-label="갤러리에서 선택" onChange={onFile} />
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                { id: 'camera', label: '카메라 촬영', icon: Camera },
                { id: 'gallery', label: '갤러리', icon: ImageIcon },
                { id: 'sample', label: '예시 사진', icon: Sparkles },
              ] as const
            ).map((b) => (
              <button key={b.label} type="button" onClick={() => pickSource(b.id)} className="flex h-24 flex-col items-center justify-center gap-2 rounded-2xl border border-border bg-surface text-[13px] font-medium hover:bg-surface-muted">
                <AppIcon icon={b.icon} size="md" bg="soft" className="size-10 rounded-xl" />
                {b.label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[12px] text-text-subtle">{isLive && !apiReady ? '준비 중 · 사진 인식은 서버(FastAPI) 연결 후 열려요. 지금은 직접 검색해서 기록해 주세요.' : '한 상 차림도 사진 한 장으로 음식을 한꺼번에 찾아요.'}</p>
        </section>

        {publicFoods === 0 && (
          <p className="rounded-2xl bg-review-soft px-4 py-3 text-[13px] leading-relaxed text-review">
            공용 음식 DB(식약처 영양성분)가 아직 비어 있어요. 지금은 <b>직접 등록한 음식</b>만 검색돼요.
          </p>
        )}

        {/* B. 직접 검색 */}
        <section aria-labelledby="sec-search">
          <h2 id="sec-search" className="mb-2 text-[15px] font-bold">
            직접 검색해서 기록하기
          </h2>
          <Link to="/record/meal/search" className="flex h-12 items-center gap-3 rounded-full border border-border bg-surface px-4 text-[15px] text-text-subtle hover:bg-surface-muted">
            <AppIcon icon={Search} size="sm" tone="muted" />
            음식명 또는 제품명을 검색해보세요.
          </Link>
        </section>

        {/* C. 최근 · 즐겨찾기 */}
        <section aria-labelledby="sec-recent">
          <div className="mb-2 flex items-center justify-between">
            <h2 id="sec-recent" className="text-[15px] font-bold">
              최근 먹은 음식
            </h2>
            <div role="tablist" aria-label="최근·즐겨찾기" className="inline-flex rounded-lg bg-surface-muted p-0.5 text-[13px]">
              {(
                [
                  ['recent', '최근'],
                  ['fav', '즐겨찾기'],
                ] as const
              ).map(([v, l]) => (
                <button key={v} type="button" role="tab" aria-selected={tab === v} onClick={() => setTab(v)} className={cn('h-8 rounded-md px-3 font-medium', tab === v ? 'bg-surface text-text shadow-sm' : 'text-text-muted')}>
                  {l}
                </button>
              ))}
            </div>
          </div>
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
            {(tab === 'recent' ? recents.map((r) => ({ food: r.food, grams: r.grams })) : favFoods.map((f) => ({ food: f!, grams: f!.servingGrams }))).map(({ food, grams }) => {
              const n = nutrientsFor(food, grams)
              return (
                <li key={food.id}>
                  <Link to={`/record/meal/food/${food.id}?grams=${grams}`} className="flex min-h-[60px] items-center gap-3 px-4 py-2.5 hover:bg-surface-muted/60">
                    {tab === 'fav' && <Star size={16} strokeWidth={1.75} className="fill-review text-review" aria-hidden />}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-medium">{food.name}</span>
                      <span className="tabular block text-[12px] text-text-muted">
                        {tab === 'recent' ? '지난번' : '1인분'} {grams}g · 단백질 {fmtG(n.proteinG)}
                      </span>
                    </span>
                    <span className="tabular text-[14px] font-semibold">{n.kcal}kcal</span>
                    <AppIcon icon={ChevronRight} size="sm" tone="muted" />
                  </Link>
                </li>
              )
            })}
            {(tab === 'recent' ? recents.length : favFoods.length) === 0 && (
              <li className="px-4 py-6 text-center text-[13px] text-text-muted">{tab === 'recent' ? '아직 기록한 음식이 없어요.' : '검색 결과의 별을 눌러 즐겨찾기에 추가해요.'}</li>
            )}
          </ul>
        </section>
      </div>

      {pending && (
        <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 px-5 pb-3 md:bottom-4 md:left-20 lg:left-60">
          <Link to="/record/meal/review" className="mx-auto flex h-14 max-w-lg items-center justify-between rounded-2xl bg-text px-5 text-surface shadow-lg">
            <span className="text-[14px] font-semibold">작성 중인 식단 {draft.items.length}개 · {pendingKcal.toLocaleString()}kcal</span>
            <span className="inline-flex items-center gap-1 text-[14px]">
              이어서 <ChevronRight size={16} strokeWidth={2} aria-hidden />
            </span>
          </Link>
        </div>
      )}
    </>
  )
}
