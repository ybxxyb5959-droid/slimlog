import type { ActivityLevel } from '@/lib/bodyProfile'
import { isLive } from '@/lib/supabase'
import { updateHealth } from '@/services/live/account'
import { useAuthStore } from '@/stores/authStore'
import { ML_PER_CUP, useIntakeStore } from '@/stores/intakeStore'

/**
 * 하루 기록 목표 (열량 · 탄수화물 · 단백질 · 지방 · 물). 사용자가 직접 정하거나,
 * 참고 계산 결과를 '내 목표로 쓰기'로 확정한 값만 저장한다 (앱이 몰래 넣지 않음).
 * - 실서비스: user_health.kcal_goal / carb_goal_g / protein_goal_g / fat_goal_g / water_goal_ml
 * - 목업: 화면 메모리에만
 */
export const GOAL_RANGE = {
  kcal: [800, 5000],
  carbG: [0, 800],
  proteinG: [0, 400],
  fatG: [0, 300],
  waterCups: [1, 24],
} as const

type Field = keyof typeof GOAL_RANGE
const LABEL: Record<Field, string> = { kcal: '열량 목표', carbG: '탄수화물 목표', proteinG: '단백질 목표', fatG: '지방 목표', waterCups: '물 목표' }
const UNIT: Record<Field, string> = { kcal: 'kcal', carbG: 'g', proteinG: 'g', fatG: 'g', waterCups: '컵' }

export type GoalInput = Record<Field, string>
export type ParsedGoals = { kcal: number | null; carbG: number | null; proteinG: number | null; fatG: number | null; waterCups: number }

/** 빈 칸 = 목표 없음. 물은 꼭 있어야 함(진행 막대 기준) */
export function parseGoals(v: GoalInput): { value?: ParsedGoals; error?: { field: Field; message: string } } {
  const out: Partial<ParsedGoals> = {}
  for (const f of Object.keys(GOAL_RANGE) as Field[]) {
    const raw = v[f].trim()
    const [lo, hi] = GOAL_RANGE[f]
    if (raw === '') {
      if (f === 'waterCups') return { error: { field: f, message: `${LABEL[f]}는 ${lo}~${hi}${UNIT[f]} 정수로 적어 주세요.` } }
      out[f] = null
      continue
    }
    const n = Number(raw)
    if (!Number.isInteger(n) || n < lo || n > hi) return { error: { field: f, message: `${LABEL[f]}는 ${lo}~${hi}${UNIT[f]} 정수로 적어 주세요.` } }
    out[f] = n
  }
  return { value: out as ParsedGoals }
}

export async function saveGoals(g: ParsedGoals) {
  const waterGoalMl = g.waterCups * ML_PER_CUP
  await saveNutritionGoals({ kcal: g.kcal, carbG: g.carbG, proteinG: g.proteinG, fatG: g.fatG }, { waterGoalMl })
}

/** 열량·탄단지 목표 저장 — 참고 계산의 '내 목표로 쓰기'도 이걸 쓴다 (활동량을 바꿨으면 같이 저장) */
export async function saveNutritionGoals(
  g: { kcal: number | null; carbG: number | null; proteinG: number | null; fatG: number | null },
  extra: { waterGoalMl?: number; activity?: ActivityLevel | null } = {},
) {
  if (isLive) {
    const a = useAuthStore.getState().account
    if (!a) throw new Error('로그인이 필요해요')
    await updateHealth(a.userId, {
      kcal_goal: g.kcal,
      carb_goal_g: g.carbG,
      protein_goal_g: g.proteinG,
      fat_goal_g: g.fatG,
      ...(extra.waterGoalMl !== undefined && { water_goal_ml: extra.waterGoalMl }),
      ...(extra.activity !== undefined && { activity_level: extra.activity }),
    })
    useAuthStore.setState({
      account: {
        ...a,
        kcalGoal: g.kcal,
        carbGoalG: g.carbG,
        proteinGoalG: g.proteinG,
        fatGoalG: g.fatG,
        ...(extra.waterGoalMl !== undefined && { waterGoalMl: extra.waterGoalMl }),
        ...(extra.activity !== undefined && { activityLevel: extra.activity }),
      },
    })
  }
  useIntakeStore.setState({
    kcalGoal: g.kcal,
    carbGoalG: g.carbG,
    proteinGoalG: g.proteinG,
    fatGoalG: g.fatG,
    ...(extra.waterGoalMl !== undefined && { waterGoalMl: extra.waterGoalMl }),
  })
}
