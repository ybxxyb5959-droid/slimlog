import { sb } from '@/lib/supabase'
import type { MealType } from '@/types/domain'
import type { FoodCategory, FoodItem, MealItem, MealRecord } from '@/types/meal'

/**
 * 식단 — foods(공용·내 음식), meals(식사 1건), meal_items(음식 1개, 영양 스냅숏) 접근
 * 사진 기록(meals.source = 'photo')은 서버(FastAPI)만 만들 수 있다 (RLS). 여기서는 수동 기록만 만든다.
 */

const FOOD_COLS = 'food_id, owner_id, name, brand, category, basis_grams, basis_label, serving_g, units, kcal, carb_g, protein_g, fat_g, data_source'
type FoodRow = {
  food_id: string
  owner_id: string | null
  name: string
  brand: string | null
  category: string
  basis_grams: number
  basis_label: string
  serving_g: number
  units: unknown
  kcal: number
  carb_g: number | null
  protein_g: number | null
  fat_g: number | null
  data_source: string | null
}
const n = (v: number | null) => (v === null ? null : Number(v))
export const rowToFood = (r: FoodRow): FoodItem => ({
  id: r.food_id,
  name: r.name,
  brand: r.brand ?? undefined,
  category: r.category as FoodCategory,
  basisGrams: Number(r.basis_grams),
  basisLabel: r.basis_label,
  servingGrams: Number(r.serving_g),
  units: Array.isArray(r.units) ? (r.units as FoodItem['units']) : undefined,
  kcal: Number(r.kcal),
  carbG: n(r.carb_g),
  proteinG: n(r.protein_g),
  fatG: n(r.fat_g),
  custom: r.owner_id !== null,
})

/** 이름 검색 (공용 + 내 음식, RLS 가 남의 음식은 숨김) */
export async function searchFoodsRemote(q: string, limit = 30): Promise<FoodItem[]> {
  const term = q.trim().replace(/[%_,()]/g, '')
  if (!term) return []
  const r = await sb().from('foods').select(FOOD_COLS).ilike('name', `%${term}%`).order('name').limit(limit)
  if (r.error) throw r.error
  return r.data.map(rowToFood)
}

export async function fetchFoodsByIds(ids: string[]): Promise<FoodItem[]> {
  if (!ids.length) return []
  const r = await sb().from('foods').select(FOOD_COLS).in('food_id', ids)
  if (r.error) throw r.error
  return r.data.map(rowToFood)
}

export async function fetchMyFoods(userId: string): Promise<FoodItem[]> {
  const r = await sb().from('foods').select(FOOD_COLS).eq('owner_id', userId).order('created_at', { ascending: false })
  if (r.error) throw r.error
  return r.data.map(rowToFood)
}

/** 공용 음식 DB 가 비어 있는지 (식약처 데이터 넣기 전 안내용) */
export async function publicFoodCount(): Promise<number> {
  const r = await sb().from('foods').select('food_id', { count: 'exact', head: true }).is('owner_id', null)
  if (r.error) throw r.error
  return r.count ?? 0
}

export async function insertMyFood(userId: string, f: FoodItem) {
  const r = await sb()
    .from('foods')
    .insert({
      food_id: f.id,
      owner_id: userId,
      name: f.name,
      brand: f.brand ?? null,
      category: f.category,
      basis_grams: f.basisGrams,
      basis_label: f.basisLabel,
      serving_g: f.servingGrams,
      units: f.units ?? null,
      kcal: f.kcal,
      carb_g: f.carbG,
      protein_g: f.proteinG,
      fat_g: f.fatG,
      data_source: '사용자 직접 등록',
    })
  if (r.error) throw r.error
}

// ── 식사 ─────────────────────────────────────────────────────
type ItemRow = { item_id: string; food_id: string | null; name: string; brand: string | null; grams: number; kcal: number; carb_g: number | null; protein_g: number | null; fat_g: number | null; from_photo: boolean; sort_order: number }
type MealRow = { meal_id: string; meal_type: string; eaten_at: string; source: string; photo_path: string | null; meal_items: ItemRow[] }

const rowToMeal = (r: MealRow): MealRecord => ({
  id: r.meal_id,
  mealType: r.meal_type as MealType,
  eatenAt: r.eaten_at,
  source: r.source as 'photo' | 'manual',
  photoId: r.photo_path ?? undefined,
  items: [...r.meal_items]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((i) => ({
      id: i.item_id,
      foodId: i.food_id ?? '',
      name: i.name,
      brand: i.brand ?? undefined,
      grams: Number(i.grams),
      kcal: Number(i.kcal),
      carbG: n(i.carb_g),
      proteinG: n(i.protein_g),
      fatG: n(i.fat_g),
      fromPhoto: i.from_photo || undefined,
    })),
})

export async function fetchMeals(sinceDays = 60): Promise<MealRecord[]> {
  const since = new Date(Date.now() - sinceDays * 86_400_000).toISOString()
  const r = await sb()
    .from('meals')
    .select('meal_id, meal_type, eaten_at, source, photo_path, meal_items(item_id, food_id, name, brand, grams, kcal, carb_g, protein_g, fat_g, from_photo, sort_order)')
    .gte('eaten_at', since)
    .order('eaten_at', { ascending: false })
  if (r.error) throw r.error
  return (r.data as unknown as MealRow[]).map(rowToMeal)
}

const itemRows = (mealId: string, items: MealItem[]) =>
  items.map((i, idx) => ({
    item_id: i.id,
    meal_id: mealId,
    food_id: i.foodId || null,
    name: i.name,
    brand: i.brand ?? null,
    grams: i.grams,
    kcal: i.kcal,
    carb_g: i.carbG,
    protein_g: i.proteinG,
    fat_g: i.fatG,
    from_photo: !!i.fromPhoto,
    sort_order: idx,
  }))

export async function insertMeal(r: MealRecord) {
  const db = sb()
  const m = await db.from('meals').insert({ meal_id: r.id, meal_type: r.mealType, eaten_at: r.eatenAt, source: 'manual' })
  if (m.error) throw m.error
  if (r.items.length) {
    const it = await db.from('meal_items').insert(itemRows(r.id, r.items))
    if (it.error) {
      await db.from('meals').delete().eq('meal_id', r.id) // 음식 저장 실패 시 빈 식사가 남지 않게
      throw it.error
    }
  }
}

/** 수정: 끼니·시간 갱신 + 음식 목록 통째로 교체 */
export async function updateMeal(r: MealRecord) {
  const db = sb()
  const m = await db.from('meals').update({ meal_type: r.mealType, eaten_at: r.eatenAt }).eq('meal_id', r.id)
  if (m.error) throw m.error
  const d = await db.from('meal_items').delete().eq('meal_id', r.id)
  if (d.error) throw d.error
  if (r.items.length) {
    const it = await db.from('meal_items').insert(itemRows(r.id, r.items))
    if (it.error) throw it.error
  }
}

export async function deleteMeal(id: string) {
  const r = await sb().from('meals').delete().eq('meal_id', id).select('meal_id')
  if (r.error) throw r.error
  if (!r.data.length) throw new Error('사진 기록은 서버 연결 후 삭제할 수 있어요.')
}
