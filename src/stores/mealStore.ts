import { toast } from 'sonner'
import { create } from 'zustand'

import { DEFAULT_FAVORITES, FOOD_CATALOG } from '@/fixtures/foodCatalog.mock'
import { addDays, startOfDay } from '@/lib/date'
import { nutrientsFor } from '@/lib/nutrition'
import { api } from '@/lib/api'
import { dbErrorMessage, isLive } from '@/lib/supabase'
import { deleteMeal, insertMeal, insertMyFood, updateMeal } from '@/services/live/meals'
import type { Meal, MealType } from '@/types/domain'
import type { FoodItem, MealItem, MealRecord } from '@/types/meal'

/**
 * 식단 기록 — 목업: 화면에만 저장 / 실서비스: meals·meal_items·foods 에 저장 (화면 먼저 반영, 실패 시 되돌림)
 * 즐겨찾기는 DB 칸이 없어 이 기기에만 저장한다 (사용자별 localStorage).
 * 식사 기록(MealRecord.id)과 음식 항목(MealItem.id)은 서로 다른 식별자를 가진다.
 */
let seq = 0
/** 실서비스: DB 의 uuid 칸에 바로 넣을 수 있게 uuid 를 쓴다 (내 음식 id 는 'myfood-' + uuid) */
export const newId = (p: string) =>
  isLive ? (p === 'myfood' ? `myfood-${crypto.randomUUID()}` : crypto.randomUUID()) : `${p}-${Date.now().toString(36)}-${(seq++).toString(36)}`

const food = (id: string) => FOOD_CATALOG.find((f) => f.id === id)!
export function makeItem(f: FoodItem, grams: number, extra: Partial<MealItem> = {}): MealItem {
  return { id: newId('item'), foodId: f.id, name: f.name, brand: f.brand, grams, ...nutrientsFor(f, grams), ...extra }
}

const at = (dayOffset: number, h: number, m: number) => {
  const d = addDays(startOfDay(new Date()), dayOffset)
  d.setHours(h, m, 0, 0)
  return d.toISOString()
}

/** 예시 사용자 기록 (오늘·어제) */
const demoRecords = (): MealRecord[] => [
  { id: 'rec-demo-1', mealType: 'breakfast', eatenAt: at(0, 8, 10), source: 'manual', items: [makeItem(food('greek-yogurt'), 100), makeItem(food('banana'), 120)] },
  {
    id: 'rec-demo-2',
    mealType: 'lunch',
    eatenAt: at(0, 12, 40),
    source: 'photo',
    photoId: 'photo-demo',
    items: [makeItem(food('kimchi-jjigae'), 400, { fromPhoto: true }), makeItem(food('rice'), 210, { fromPhoto: true })],
  },
  { id: 'rec-demo-3', mealType: 'snack', eatenAt: at(0, 16, 0), source: 'manual', items: [makeItem(food('boiled-egg'), 100)] },
  { id: 'rec-demo-4', mealType: 'dinner', eatenAt: at(-1, 19, 20), source: 'manual', items: [makeItem(food('chicken-breast'), 150), makeItem(food('multigrain-rice'), 210), makeItem(food('kimchi'), 50)] },
]

interface MealState {
  records: MealRecord[]
  customFoods: FoodItem[]
  favorites: string[]
  addRecord: (r: Omit<MealRecord, 'id'>) => string
  updateRecord: (r: MealRecord) => void
  removeRecord: (id: string) => void
  addCustomFood: (f: Omit<FoodItem, 'id' | 'custom' | 'category'>) => FoodItem
  toggleFavorite: (foodId: string) => void
  resetEmpty: () => void
  resetDemo: () => void
}

/** 실서비스 저장 — 실패하면 화면 변경을 되돌리고 알린다 */
function persist(run: () => Promise<unknown>, undo: () => void) {
  if (!isLive) return
  run().catch((e) => {
    undo()
    toast.error('식단을 저장하지 못했어요', { description: dbErrorMessage(e) })
  })
}

const favKey = (uid: string) => `slimlog:favorites:${uid}`
export function loadFavorites(uid: string): string[] {
  try {
    return JSON.parse(localStorage.getItem(favKey(uid)) ?? '[]') as string[]
  } catch {
    return []
  }
}
let favUser: string | null = null
export const setFavoritesUser = (uid: string | null) => (favUser = uid)

export const useMealStore = create<MealState>((set, get) => ({
  records: demoRecords(),
  customFoods: [],
  favorites: DEFAULT_FAVORITES,
  addRecord: (r) => {
    const id = newId('rec')
    const rec = { ...r, id }
    set((s) => ({ records: [...s.records, rec] }))
    persist(() => insertMeal(rec), () => set((s) => ({ records: s.records.filter((x) => x.id !== id) })))
    return id
  },
  updateRecord: (r) => {
    const prev = get().records
    set((s) => ({ records: s.records.map((x) => (x.id === r.id ? r : x)) }))
    persist(() => updateMeal(r), () => set({ records: prev }))
  },
  removeRecord: (id) => {
    const prev = get().records
    const rec = prev.find((x) => x.id === id)
    set((s) => ({ records: s.records.filter((x) => x.id !== id) }))
    // 사진 기록은 Storage 파일까지 지워야 해서 서버 API 로 (앱은 사진 기록을 직접 못 지움)
    persist(() => (rec?.source === 'photo' ? api(`/meals/${id}`, { method: 'DELETE' }) : deleteMeal(id)), () => set({ records: prev }))
  },
  addCustomFood: (f) => {
    const item: FoodItem = { ...f, id: newId('myfood'), custom: true, category: '내 음식' }
    set((s) => ({ customFoods: [...s.customFoods, item] }))
    if (isLive && favUser) {
      const uid = favUser
      persist(() => insertMyFood(uid, item), () => set((s) => ({ customFoods: s.customFoods.filter((x) => x.id !== item.id) })))
    }
    return item
  },
  toggleFavorite: (foodId) => {
    set((s) => ({ favorites: s.favorites.includes(foodId) ? s.favorites.filter((x) => x !== foodId) : [...s.favorites, foodId] }))
    if (isLive && favUser)
      try {
        localStorage.setItem(favKey(favUser), JSON.stringify(get().favorites))
      } catch {
        /* 저장 못 해도 이번 화면에서는 유지 */
      }
  },
  resetEmpty: () => set({ records: [], customFoods: [], favorites: [] }),
  resetDemo: () => set({ records: demoRecords(), customFoods: [], favorites: DEFAULT_FAVORITES }),
}))

/** 홈·요약용 평탄화 (음식 1개 = 1행) */
export function flattenMeals(records: MealRecord[]): Meal[] {
  return records.flatMap((r) =>
    r.items.map((i) => ({
      id: i.id,
      mealType: r.mealType as MealType,
      eatenAt: r.eatenAt,
      foodName: i.name,
      servings: 1,
      kcal: i.kcal,
      proteinG: i.proteinG ?? 0,
      carbG: i.carbG ?? 0,
      fatG: i.fatG ?? 0,
      sodiumMg: 0,
      photoGroupId: r.photoId,
      corrected: i.corrected,
    })),
  )
}
