import { create } from 'zustand'

import { FOOD_CATALOG } from '@/fixtures/foodCatalog.mock'
import { isLive } from '@/lib/supabase'
import { searchFoodsRemote } from '@/services/live/meals'
import { useMealStore } from '@/stores/mealStore'
import type { FoodItem } from '@/types/meal'

/**
 * 음식 사전 데이터 접근 계층 — 화면은 이 함수들만 쓴다 (동기 함수).
 * - 목업: 예시 샘플 56종 + 사용자 등록 음식(화면 상태)
 * - 실서비스: DB foods 테이블. 검색할 때마다 서버에서 찾아 이 캐시에 쌓고, 화면은 캐시에서 읽는다.
 *   공용 음식은 식약처 식품영양성분 DB 를 넣은 뒤부터 검색된다 (scripts/import_foods.py)
 */
const norm = (s: string) => s.replace(/\s+/g, '').toLowerCase()

export const useFoodCache = create<{ foods: FoodItem[]; searching: boolean }>(() => ({ foods: [], searching: false }))

export function cacheFoods(list: FoodItem[]) {
  if (!list.length) return
  useFoodCache.setState((s) => {
    const map = new Map(s.foods.map((f) => [f.id, f]))
    for (const f of list) map.set(f.id, f)
    return { foods: [...map.values()] }
  })
}

/** 같은 검색어는 5분 동안 다시 묻지 않음 */
const recent = new Map<string, number>()
let inflight: AbortController | null = null

/**
 * 서버 검색 → 캐시에 추가 (실서비스 전용)
 * 글자를 더 치면 앞 요청은 취소한다 (느린 옛 결과가 늦게 와서 화면을 덮지 않게)
 */
export async function searchFoodsLive(query: string) {
  const q = query.trim()
  if (!isLive || !q) return
  const at = recent.get(q)
  if (at && Date.now() - at < 5 * 60 * 1000) return
  inflight?.abort()
  const ctl = new AbortController()
  inflight = ctl
  useFoodCache.setState({ searching: true })
  try {
    const found = await searchFoodsRemote(q, 30, ctl.signal)
    if (ctl.signal.aborted) return
    cacheFoods(found)
    recent.set(q, Date.now())
  } catch (e) {
    if (ctl.signal.aborted || (e as Error).name === 'AbortError') return
    throw e
  } finally {
    if (inflight === ctl) {
      inflight = null
      useFoodCache.setState({ searching: false })
    }
  }
}

export function allFoods(): FoodItem[] {
  const mine = useMealStore.getState().customFoods
  if (isLive) return [...mine, ...useFoodCache.getState().foods.filter((f) => !mine.some((m) => m.id === f.id))]
  return [...mine, ...FOOD_CATALOG]
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
    // 서버(search_foods)와 같은 순서: 같은 이름 → 앞부분 일치 → 일반 음식(가공식품 아님) → 짧은 이름
    .sort((a, b) => {
      const rank = (f: FoodItem) => [norm(f.name) === q ? 0 : 1, norm(f.name).startsWith(q) ? 0 : 1, String(f.category) === '가공식품' ? 1 : 0, f.name.length] as const
      const ra = rank(a)
      const rb = rank(b)
      for (let i = 0; i < ra.length; i++) if (ra[i] !== rb[i]) return ra[i] - rb[i]
      return a.name.localeCompare(b.name, 'ko')
    })
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
