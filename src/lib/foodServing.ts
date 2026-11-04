import type { FoodItem } from '../types/meal'

/**
 * 음식의 '1회 단위' 이름 — 햄버거는 1개, 김밥은 1줄, 찌개·밥은 1인분처럼 바로 담기 쉬운 말로.
 * 무게는 데이터의 1회 제공량(servingGrams) 그대로 쓴다 (단위 이름만 바꿈, 새 숫자를 지어내지 않음).
 * 제품 단위(units)가 있으면 그게 우선.
 */
const RULES: [RegExp, string][] = [
  [/버거|샌드위치|토스트|핫도그|도넛|도너츠|베이글|머핀|크루?아상|주먹밥|삼각김밥|타코|부리또|브리또|와플|핫바|소시지빵|단팥빵|크림빵|소보로/, '개'],
  [/김밥/, '줄'],
]

export function servingUnit(food: Pick<FoodItem, 'name' | 'servingGrams' | 'units' | 'brand'>): { word: string; label: string; grams: number } {
  const u = food.units?.[0]
  if (u) {
    const word = u.label.replace(/^1\s*/, '') || '개'
    return { word, label: `1${word}`, grams: u.grams }
  }
  const hit = RULES.find(([re]) => re.test(food.name))
  const word = hit ? hit[1] : food.brand ? '회분' : '인분'
  return { word, label: `1${word}`, grams: food.servingGrams }
}
