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
  /** 선택형 용량 목록(허가 용량). 확인하지 못했으면 null → 직접 입력 */
  doseOptionsMg: number[] | null
  /** 허가 정보 출처 — 용량·주사 부위 */
  approval: MedicationApproval
}

export type SourceStatus = 'verified' | 'secondary'

export interface ApprovalSource {
  title: string
  url: string
  checkedAt: string // YYYY-MM-DD
  /** verified: 의약품안전나라 원문 확인 / secondary: 보도·안내 자료로 확인, 원문 대조 필요 */
  status: SourceStatus
}

export type BodyArea = 'abdomen' | 'thigh' | 'upper_arm'

export interface MedicationApproval {
  doses: ApprovalSource | null
  /** 허가된 주사 부위. null이면 확인 전 → 부위 선택 막지 않고 안내만 표시 */
  sites: { areas: BodyArea[]; source: ApprovalSource } | null
}

/** 'thigh' | 'arm' 은 좌우 구분 이전 기록과의 호환용 */
export type InjectionSite =
  | 'abdomen_left'
  | 'abdomen_right'
  | 'thigh_left'
  | 'thigh_right'
  | 'arm_left'
  | 'arm_right'
  | 'thigh'
  | 'arm'

/** DOSES */
export interface Dose {
  id: string
  medicationId: MedicationId
  doseMg: number
  administeredAt: string // ISO 8601
  site: InjectionSite
  memo?: string
  /** 시간을 기억하지 못함 → 시각은 12:00으로 두고 화면에 '시간 모름' 표시 */
  timeUnknown?: boolean
  /** 날짜가 정확하지 않음(대략) */
  dateApproximate?: boolean
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
