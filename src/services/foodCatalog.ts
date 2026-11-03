import { FOOD_CATALOG } from '@/fixtures/foodCatalog.mock'
import { useMealStore } from '@/stores/mealStore'
import type { FoodItem } from '@/types/meal'

/**
 * 음식 사전 데이터 접근 계층 — 화면은 이 함수들만 쓴다.
 * 지금: 목업 샘플 + 사용자 등록 음식(화면 상태)
 * 연결 시: 식약처 식품영양성분 DB(공공데이터) 검색 API + USER_FOODS 테이블로 교체
 */
const norm = (s: string) => s.replace(/\s+/g, '').toLowerCase()

export function allFoods(): FoodItem[] {
  return [...useMealStore.getState().customFoods, ...FOOD_CATALOG]
}

export function getFood(id: string | null | undefined): FoodItem | undefined {
  if (!id) return undefined
  return allFoods().find((f) => f.id === id)
}

export function searchFoods(query: string): FoodItem[] {
  const q = norm(query)
  if (!q) return []
  return allFoods()
    .filter((f) => norm(f.name).includes(q) || (f.brand && norm(f.brand).includes(q)))
    .sort((a, b) => Number(norm(b.name).startsWith(q)) - Number(norm(a.name).startsWith(q)) || a.name.localeCompare(b.name, 'ko'))
}

/** 최근 먹은 음식 — 기록에서 음식별 가장 최근 섭취량 */
export function recentFoods(limit = 8): { food: FoodItem; grams: number; at: string }[] {
  const records = [...useMealStore.getState().records].sort((a, b) => b.eatenAt.localeCompare(a.eatenAt))
  const seen = new Map<string, { food: FoodItem; grams: number; at: string }>()
  for (const r of records)
    for (const i of r.items) {
      const f = getFood(i.foodId)
      if (f && !seen.has(f.id)) seen.set(f.id, { food: f, grams: i.grams, at: r.eatenAt })
    }
  return [...seen.values()].slice(0, limit)
}

export function lastGramsOf(foodId: string): number | undefined {
  return recentFoods(100).find((r) => r.food.id === foodId)?.grams
}

export const SEARCH_EXAMPLES = ['쌀밥', '닭가슴살', '김치찌개', '계란말이', '햇반', '바나나', '샌드위치']
