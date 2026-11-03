import { create } from 'zustand'

import { MOCK_TODAY_MEALS } from '@/fixtures/records.mock'
import type { Meal } from '@/types/domain'

/**
 * 식단 기록 — 목업 상태. 한 장의 사진에서 나온 여러 음식은 photoGroupId로 묶는다.
 * 연결 예정: MEALS(음식 1개 = 1행) + PREDICTIONS(영역별 Top-3, corrected_food_id)
 */
interface MealState {
  meals: Meal[]
  addMeals: (meals: Omit<Meal, 'id'>[]) => void
  removeMeal: (id: string) => void
  resetEmpty: () => void
  resetDemo: () => void
}

let seq = 0
export const useMealStore = create<MealState>((set) => ({
  meals: MOCK_TODAY_MEALS,
  addMeals: (items) => set((s) => ({ meals: [...s.meals, ...items.map((m) => ({ ...m, id: `meal-${Date.now()}-${seq++}` }))] })),
  removeMeal: (id) => set((s) => ({ meals: s.meals.filter((m) => m.id !== id) })),
  resetEmpty: () => set({ meals: [] }),
  resetDemo: () => set({ meals: MOCK_TODAY_MEALS }),
}))
