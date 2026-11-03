/**
 * 도메인 타입 — 계획서 6.6 ERD / 6.7 API 이름에 맞춘다.
 * 백엔드(FastAPI) 연결 시 응답 스키마와 1:1로 맞추는 것이 목표.
 */

export type MedicationId = 'mounjaro' | 'wegovy' | 'efpe'

/** MEDICATIONS */
export interface Medication {
  id: MedicationId
  name: string
  ingredient: string
  /** 반감기(시간). 출처가 없으면 null → 참고 곡선을 만들지 않는다 (계획서 6.3) */
  halfLifeHours: number | null
  halfLifeSource: { label: string; note: string } | null
  /** 선택형 용량 목록. 없으면 직접 입력 */
  doseOptionsMg: number[] | null
}

export type InjectionSite = 'abdomen_left' | 'abdomen_right' | 'thigh' | 'arm'

/** DOSES */
export interface Dose {
  id: string
  medicationId: MedicationId
  doseMg: number
  administeredAt: string // ISO 8601
  site: InjectionSite
  memo?: string
}

export type BodyLogSource = 'MANUAL' | 'INBODY_OCR' | 'INBODY_API'

/** BODY_LOGS — 체중과 체성분을 한 테이블에 저장 */
export interface BodyLog {
  id: string
  measuredAt: string
  weightKg: number
  skeletalMuscleKg?: number
  bodyFatKg?: number
  bodyFatPct?: number
  source: BodyLogSource
  isVerified: boolean
}

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack'

/** MEALS (+ PREDICTIONS는 식단 AI 화면에서 사용) */
export interface Meal {
  id: string
  mealType: MealType
  eatenAt: string
  foodName: string
  servings: number
  kcal: number
  proteinG: number
  carbG: number
  fatG: number
  sodiumMg: number
}

export type SymptomType = 'nausea' | 'fatigue' | 'constipation' | 'headache' | 'heartburn' | 'low_appetite'

/** SYMPTOMS */
export interface Symptom {
  id: string
  recordedAt: string
  type: SymptomType
  severity: 1 | 2 | 3
}

/** DAILY_CHECKS */
export interface DailyCheck {
  date: string // YYYY-MM-DD
  waterCups: number
  waterGoalCups: number
  proteinG: number
  proteinGoalG: number
  supplementTaken: boolean
  /** 1(나쁨) ~ 5(좋음) */
  condition: 1 | 2 | 3 | 4 | 5
}

/** GET /timeline 응답의 하루 단위 */
export interface TimelineDay {
  date: string
  kcal: number | null
  doses: Pick<Dose, 'medicationId' | 'doseMg'>[]
  symptomCount: number
  weightKg: number | null
}

/** GET /residual-curve — 상대값(기간 내 최댓값 = 100) */
export interface ResidualPoint {
  t: number // epoch ms
  relative: number // 0~100
}

export interface UserProfile {
  nickname: string
  startWeightKg: number
  goalWeightKg: number
  medicationId: MedicationId
  startedAt: string
}

/** 서버 오류 형식 (계획서 6.7) */
export interface ApiError {
  code: string
  message: string
  field?: string
}
