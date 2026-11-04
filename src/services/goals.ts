import { isLive } from '@/lib/supabase'
import { updateHealth } from '@/services/live/account'
import { useAuthStore } from '@/stores/authStore'
import { ML_PER_CUP, useIntakeStore } from '@/stores/intakeStore'

/**
 * 하루 기록 목표 (단백질 g · 물 컵). 사용자가 직접 정하는 값이고 앱이 추천하지 않는다.
 * - 실서비스: user_health.protein_goal_g / water_goal_ml 에 저장
 * - 목업: 화면 메모리에만
 */
export const GOAL_RANGE = { proteinG: [0, 400], waterCups: [1, 24] } as const

export type GoalInput = { proteinG: string; waterCups: string }
export type ParsedGoals = { proteinG: number | null; waterCups: number }

/** 빈 단백질 = 목표 없음. 물은 꼭 있어야 함(진행 막대 기준) */
export function parseGoals(v: GoalInput): { value?: ParsedGoals; error?: { field: 'proteinG' | 'waterCups'; message: string } } {
  const p = v.proteinG.trim()
  const w = v.waterCups.trim()
  let proteinG: number | null = null
  if (p !== '') {
    const n = Number(p)
    const [lo, hi] = GOAL_RANGE.proteinG
    if (!Number.isInteger(n) || n < lo || n > hi) return { error: { field: 'proteinG', message: `단백질 목표는 ${lo}~${hi}g 정수로 적어 주세요.` } }
    proteinG = n
  }
  const c = Number(w)
  const [lo, hi] = GOAL_RANGE.waterCups
  if (w === '' || !Number.isInteger(c) || c < lo || c > hi) return { error: { field: 'waterCups', message: `물 목표는 ${lo}~${hi}컵 정수로 적어 주세요.` } }
  return { value: { proteinG, waterCups: c } }
}

export async function saveGoals(g: ParsedGoals) {
  const waterGoalMl = g.waterCups * ML_PER_CUP
  if (isLive) {
    const a = useAuthStore.getState().account
    if (!a) throw new Error('로그인이 필요해요')
    await updateHealth(a.userId, { protein_goal_g: g.proteinG, water_goal_ml: waterGoalMl })
    useAuthStore.setState({ account: { ...a, proteinGoalG: g.proteinG, waterGoalMl } })
  }
  useIntakeStore.setState({ proteinGoalG: g.proteinG, waterGoalMl })
}
