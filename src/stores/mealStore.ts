import { create } from 'zustand'

import { DEFAULT_FAVORITES, FOOD_CATALOG } from '@/fixtures/foodCatalog.mock'
import { addDays, startOfDay } from '@/lib/date'
import { nutrientsFor } from '@/lib/nutrition'
import type { Meal, MealType } from '@/types/domain'
import type { FoodItem, MealItem, MealRecord } from '@/types/meal'

/**
 * 식단 기록 — 목업 상태(화면에만 저장, 새로고침 시 초기화).
 * 식사 기록(MealRecord.id)과 음식 항목(MealItem.id)은 서로 다른 식별자를 가진다.
 */
let seq = 0
export const newId = (p: string) => `${p}-${Date.now().toString(36)}-${(seq++).toString(36)}`

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

export const useMealStore = create<MealState>((set) => ({
  records: demoRecords(),
  customFoods: [],
  favorites: DEFAULT_FAVORITES,
  addRecord: (r) => {
    const id = newId('rec')
    set((s) => ({ records: [...s.records, { ...r, id }] }))
    return id
  },
  updateRecord: (r) => set((s) => ({ records: s.records.map((x) => (x.id === r.id ? r : x)) })),
  removeRecord: (id) => set((s) => ({ records: s.records.filter((x) => x.id !== id) })),
  addCustomFood: (f) => {
    const item: FoodItem = { ...f, id: newId('myfood'), custom: true, category: '내 음식' }
    set((s) => ({ customFoods: [...s.customFoods, item] }))
    return item
  },
  toggleFavorite: (foodId) =>
    set((s) => ({ favorites: s.favorites.includes(foodId) ? s.favorites.filter((x) => x !== foodId) : [...s.favorites, foodId] })),
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
