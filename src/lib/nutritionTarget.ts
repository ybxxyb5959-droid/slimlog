import { ACTIVITY_OPTIONS, type ActivityLevel, type Sex } from './bodyProfile'

/**
 * 하루 영양 '참고' 목표 계산 — 처방이 아니라 널리 쓰는 공식을 그대로 적용한 값.
 * 화면에 계산 과정을 함께 보여 주고, 사용자가 '내 목표로 쓰기'를 눌러야 저장한다.
 *
 * 1) 기초대사량: Mifflin-St Jeor (체중·키·나이·성별)
 * 2) 하루 소비 열량 = 기초대사량 × 활동 계수 (활동량을 안 골랐으면 가장 낮은 계수로 가정)
 * 3) 감량용 열량 = 소비 열량의 80% (20% 덜 먹기), 10kcal 단위 반올림, 성별 최저선 아래로는 내리지 않음
 * 4) 단백질 = 기준 체중 1kg당 1.25g (근육 유지용으로 흔히 쓰는 1.2~1.6g 범위의 아래쪽)
 *    BMI 30 이상이면 지금 체중 대신 목표 체중(없으면 BMI 25 체중)을 기준으로 써서 과하게 잡지 않음
 * 5) 지방 = 열량의 25% ÷ 9,  탄수화물 = 남은 열량 ÷ 4
 */
export const DEFICIT = 0.2
export const PROTEIN_PER_KG = 1.25
export const FAT_RATIO = 0.25
/** 너무 적게 먹는 숫자가 나오지 않게 두는 바닥선 (일반적으로 쓰는 최저 섭취 기준) */
export const KCAL_FLOOR: Record<Sex, number> = { female: 1200, male: 1500 }

export interface TargetInput {
  sex: Sex
  birthYear: number
  heightCm: number
  weightKg: number
  goalWeightKg?: number | null
  activity: ActivityLevel | null
  now?: Date
}

export interface TargetResult {
  age: number
  bmr: number
  activity: ActivityLevel
  activityAssumed: boolean
  factor: number
  tdee: number
  kcal: number
  floored: boolean
  proteinBasisKg: number
  proteinBasis: 'current' | 'goal' | 'bmi25'
  proteinG: number
  fatG: number
  carbG: number
}

const r10 = (n: number) => Math.round(n / 10) * 10

export function calcTarget(i: TargetInput): TargetResult {
  const now = i.now ?? new Date()
  const age = now.getFullYear() - i.birthYear
  const bmr = 10 * i.weightKg + 6.25 * i.heightCm - 5 * age + (i.sex === 'male' ? 5 : -161)
  const activity = i.activity ?? 'sedentary'
  const factor = ACTIVITY_OPTIONS.find((a) => a.value === activity)!.factor
  const tdee = bmr * factor
  const raw = r10(tdee * (1 - DEFICIT))
  const kcal = Math.max(raw, KCAL_FLOOR[i.sex])

  const h = i.heightCm / 100
  const bmi = i.weightKg / (h * h)
  let proteinBasis: TargetResult['proteinBasis'] = 'current'
  let proteinBasisKg = i.weightKg
  if (bmi >= 30) {
    if (i.goalWeightKg && i.goalWeightKg < i.weightKg) {
      proteinBasis = 'goal'
      proteinBasisKg = i.goalWeightKg
    } else {
      proteinBasis = 'bmi25'
      proteinBasisKg = Math.round(25 * h * h * 10) / 10
    }
  }
  const proteinG = Math.round(proteinBasisKg * PROTEIN_PER_KG)
  const fatG = Math.round((kcal * FAT_RATIO) / 9)
  const carbG = Math.max(0, Math.round((kcal - proteinG * 4 - fatG * 9) / 4))
  return {
    age,
    bmr: Math.round(bmr),
    activity,
    activityAssumed: i.activity === null,
    factor,
    tdee: Math.round(tdee),
    kcal,
    floored: kcal > raw,
    proteinBasisKg,
    proteinBasis,
    proteinG,
    fatG,
    carbG,
  }
}
