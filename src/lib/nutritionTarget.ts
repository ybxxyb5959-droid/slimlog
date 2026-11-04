import { ACTIVITY_OPTIONS, type ActivityLevel, type Sex } from './bodyProfile'

/**
 * 하루 영양 '참고' 목표 계산 (감량 기준) — 처방이 아니라 널리 쓰는 공식을 그대로 적용한 값.
 * 화면에 계산 과정을 함께 보여 주고, 사용자가 '내 목표로 쓰기'를 눌러야 저장한다.
 *
 * 1) 기초대사량: Mifflin-St Jeor (체중·키·나이·성별)
 * 2) 하루 소비 열량(유지 열량) = 기초대사량 × 활동 계수 (활동량을 안 골랐으면 가장 낮은 계수로 가정)
 * 3) 감량 속도: 일주일에 지금 체중의 0.75% (흔히 권하는 주 0.5~1% 범위의 가운데)
 *    → 하루 줄일 열량 = 체중 × 0.75% × 7,700kcal(지방 1kg) ÷ 7
 *    단, 유지 열량의 30%보다 많이 줄이지 않음(과한 절식 방지). 10kcal 단위 반올림, 성별 최저선 아래로는 내리지 않음
 *    목표 체중이 지금 체중 이상이면 감량하지 않고 유지 열량을 쓴다
 * 4) 단백질 = 기준 체중 1kg당 1.3g (감량 중 근육 유지용으로 흔히 쓰는 1.2~1.6g 범위), 최소 60g
 *    기준 체중: BMI 25 미만이면 지금 체중, 25 이상이면 목표 체중(없거나 더 높으면 BMI 25 체중) — 과하게 잡지 않게
 * 5) 지방 = 열량의 25% ÷ 9,  탄수화물 = 남은 열량 ÷ 4
 */
export const WEEKLY_LOSS_RATE = 0.0075
export const KCAL_PER_KG_FAT = 7700
export const MAX_DEFICIT_RATIO = 0.3
export const PROTEIN_PER_KG = 1.3
export const PROTEIN_MIN_G = 60
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
  /** 감량 / 이미 목표 체중이라 유지 */
  mode: 'lose' | 'maintain'
  /** 속도 기준으로 계산한 하루 줄일 열량 */
  deficitByRate: number
  /** 실제로 줄인 열량 (상한·최저선 반영 후) */
  deficit: number
  deficitCapped: boolean
  kcal: number
  floored: boolean
  /** 이 열량대로 먹으면 예상되는 주당 감량(kg, 참고) */
  weeklyLossKg: number
  /** 목표 체중까지 예상 주 수 (목표 없거나 유지면 null) */
  weeksToGoal: number | null
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
  const mode: TargetResult['mode'] = i.goalWeightKg && i.goalWeightKg >= i.weightKg ? 'maintain' : 'lose'
  const deficitByRate = Math.round((i.weightKg * WEEKLY_LOSS_RATE * KCAL_PER_KG_FAT) / 7)
  const cap = Math.round(tdee * MAX_DEFICIT_RATIO)
  const wanted = mode === 'lose' ? Math.min(deficitByRate, cap) : 0
  const raw = r10(tdee - wanted)
  const kcal = mode === 'lose' ? Math.max(raw, KCAL_FLOOR[i.sex]) : raw
  const deficit = Math.max(0, Math.round(tdee - kcal))
  const weeklyLossKg = Math.round(((deficit * 7) / KCAL_PER_KG_FAT) * 10) / 10
  const toLose = i.goalWeightKg ? i.weightKg - i.goalWeightKg : 0
  const weeksToGoal = mode === 'lose' && toLose > 0 && weeklyLossKg > 0 ? Math.ceil(toLose / weeklyLossKg) : null

  const h = i.heightCm / 100
  const bmi = i.weightKg / (h * h)
  const bmi25Kg = Math.round(25 * h * h * 10) / 10
  let proteinBasis: TargetResult['proteinBasis'] = 'current'
  let proteinBasisKg = i.weightKg
  if (bmi >= 25) {
    if (i.goalWeightKg && i.goalWeightKg < i.weightKg && i.goalWeightKg <= bmi25Kg) {
      proteinBasis = 'goal'
      proteinBasisKg = i.goalWeightKg
    } else {
      proteinBasis = 'bmi25'
      proteinBasisKg = bmi25Kg
    }
  }
  const proteinG = Math.max(PROTEIN_MIN_G, Math.round(proteinBasisKg * PROTEIN_PER_KG))
  const fatG = Math.round((kcal * FAT_RATIO) / 9)
  const carbG = Math.max(0, Math.round((kcal - proteinG * 4 - fatG * 9) / 4))
  return {
    age,
    bmr: Math.round(bmr),
    activity,
    activityAssumed: i.activity === null,
    factor,
    tdee: Math.round(tdee),
    mode,
    deficitByRate,
    deficit,
    deficitCapped: mode === 'lose' && deficitByRate > cap,
    kcal,
    floored: mode === 'lose' && kcal > raw,
    weeklyLossKg,
    weeksToGoal,
    proteinBasisKg,
    proteinBasis,
    proteinG,
    fatG,
    carbG,
  }
}
