import type { FoodItem, Nutrients } from '@/types/meal'

const round1 = (v: number) => Math.round(v * 10) / 10

/** 섭취량(g)에 맞춰 영양 값 계산 — 정보 없는 항목은 null 유지 */
export function nutrientsFor(food: Pick<FoodItem, 'basisGrams' | 'kcal' | 'carbG' | 'proteinG' | 'fatG'>, grams: number): Nutrients {
  const k = grams / food.basisGrams
  return {
    kcal: Math.round(food.kcal * k),
    carbG: food.carbG === null ? null : round1(food.carbG * k),
    proteinG: food.proteinG === null ? null : round1(food.proteinG * k),
    fatG: food.fatG === null ? null : round1(food.fatG * k),
  }
}

export interface NutrientTotals {
  kcal: number
  carbG: number
  proteinG: number
  fatG: number
  /** 정보 없음 항목이 섞여 있으면 true — 합계는 '최소값'으로 표시 */
  incomplete: boolean
}

export function sumNutrients(list: Nutrients[]): NutrientTotals {
  return list.reduce<NutrientTotals>(
    (a, n) => ({
      kcal: a.kcal + n.kcal,
      carbG: round1(a.carbG + (n.carbG ?? 0)),
      proteinG: round1(a.proteinG + (n.proteinG ?? 0)),
      fatG: round1(a.fatG + (n.fatG ?? 0)),
      incomplete: a.incomplete || n.carbG === null || n.proteinG === null || n.fatG === null,
    }),
    { kcal: 0, carbG: 0, proteinG: 0, fatG: 0, incomplete: false },
  )
}

export const fmtG = (v: number | null) => (v === null ? '정보 없음' : `${v}g`)

/** 섭취량 표시 — 1인분 배수면 함께 */
export function amountLabel(grams: number, food?: Pick<FoodItem, 'servingGrams' | 'units'>) {
  const unit = food?.units?.find((u) => Math.abs(grams / u.grams - Math.round(grams / u.grams)) < 0.01 && grams >= u.grams)
  if (unit) {
    const n = Math.round(grams / unit.grams)
    return `${unit.label.replace(/^1/, String(n))} · ${grams}g`
  }
  return `${grams}g`
}
