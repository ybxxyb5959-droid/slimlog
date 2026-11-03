/**
 * 식단 데이터 모델 — 사진 기록과 수동 기록이 같은 구조를 쓴다.
 * 연결 예정: MEALS(식사 1건) · MEAL_ITEMS(음식 1개) · PREDICTIONS(사진 영역별 AI 후보) · 사용자 음식(USER_FOODS)
 */
import type { MealType } from './domain'

/** 영양 값 — null = 정보 없음 (0으로 단정하지 않는다) */
export interface Nutrients {
  kcal: number
  carbG: number | null
  proteinG: number | null
  fatG: number | null
}

export type FoodCategory = '밥·면' | '국·찌개' | '반찬' | '일품' | '편의점' | '가공식품' | '과일·간식' | '음료' | '내 음식'

/** 음식 사전 항목 — 영양 값은 basisGrams 기준 */
export interface FoodItem extends Nutrients {
  id: string
  name: string
  brand?: string
  category: FoodCategory
  /** 영양 값의 기준 그램 (예: 100 → 100g당, 210 → 1공기 210g당) */
  basisGrams: number
  /** 기준 표시 문구 (예: '100g당', '1공기(210g)당') */
  basisLabel: string
  /** 1인분 무게 — 0.5/1/1.5/2인분 빠른 선택 기준 */
  servingGrams: number
  /** 제품 단위 (예: 1개 120g, 1팩 210g) */
  units?: { label: string; grams: number }[]
  /** 사용자가 직접 등록한 음식 */
  custom?: boolean
}

/**
 * 사진 인식 결과 한 줄 (멀티라벨 분류 — 사진 한 장에서 음식 여러 개를 '있다/없다'로 판단)
 * - status: 화면 표시용. recognized → '인식 결과', review → '확인 필요'
 * - score·threshold·modelVersion·mode 는 내부 데이터. 사용자에게 % 로 보여주지 않는다.
 */
export interface AiLabelMeta {
  status: 'recognized' | 'review'
  /** 후보 foodId — 첫 번째가 모델이 고른 음식, 나머지는 헷갈리기 쉬운 비슷한 음식 */
  candidates: string[]
  /** sigmoid 원점수 0~1 (목업이면 예시 값) */
  score: number | null
  /** 이 클래스에 적용한 기준값 (검증셋에서 클래스별로 정함) */
  threshold: number | null
  modelVersion: string
  /** model = 실제 모델 결과, mock = 시연용 목업 결과 */
  mode: 'model' | 'mock'
}

/** 식사 안의 음식 한 개 — 저장 시점의 이름·영양을 스냅숏으로 보관 */
export interface MealItem extends Nutrients {
  id: string
  foodId: string
  name: string
  brand?: string
  grams: number
  /** 사진 인식으로 들어온 항목인지 (직접 검색으로 추가한 음식은 false/없음) */
  fromPhoto?: boolean
  /** @deprecated 영역 그리기 시절 필드 — 읽기 호환용. 새 기록에는 쓰지 않는다 */
  regionNo?: number
  /** 사진 인식 결과 (내부 보관용 — 점수·기준값은 화면에 보여주지 않음) */
  ai?: AiLabelMeta
  /** AI 1순위와 다른 음식을 골랐는지 (PREDICTIONS.corrected_food_id) */
  corrected?: boolean
}

/** 식사 기록 1건 — 같은 '점심'이라도 저장한 시점이 다르면 다른 기록 */
export interface MealRecord {
  id: string
  mealType: MealType
  eatenAt: string
  source: 'photo' | 'manual'
  /** 사진 기록일 때만 — 같은 사진의 음식 묶음 */
  photoId?: string
  items: MealItem[]
}
