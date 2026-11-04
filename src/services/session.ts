import { toast } from 'sonner'

import { combineDateTime, type FirstDoseDraft } from '@/features/record/first-dose/firstDoseDraft'
import { MOCK_BODY_LOGS, MOCK_DOSES, MOCK_SYMPTOMS } from '@/fixtures/records.mock'
import type { ActivityLevel, Sex } from '@/lib/bodyProfile'
import { dbErrorMessage, isLive, sb } from '@/lib/supabase'
import { insertDose } from '@/services/live/account'
import { fetchBodyLogs } from '@/services/live/records'
import { useAuthStore } from '@/stores/authStore'
import { useIntakeStore } from '@/stores/intakeStore'
import { useMealStore } from '@/stores/mealStore'
import { useMockRecordStore } from '@/stores/mockRecordStore'
import { useOnboardingStore } from '@/stores/onboardingStore'
import { useRecordsStore } from '@/stores/recordsStore'

/**
 * 사용자 세션 · 온보딩 저장
 * - 목업 모드: 예시 사용자(6주치 기록) / 새 사용자(본인 입력만) — 브라우저 메모리
 * - 실서비스 모드: Supabase 에 저장하고 화면 스토어를 갱신한다
 */
export const isNewUser = () => isLive || !!useOnboardingStore.getState().completedAt || useOnboardingStore.getState().nicknameSaved

export function beginNewUser() {
  if (isLive) return // 실서비스: 로그인 시 서버 기록으로 채움
  useMockRecordStore.setState({ doses: [] })
  useRecordsStore.setState({ bodyLogs: [], symptoms: [], daily: [] })
  useIntakeStore.getState().resetEmpty()
  useMealStore.getState().resetEmpty()
}

const requireAccount = () => {
  const a = useAuthStore.getState().account
  if (!a) throw new Error('로그인이 필요해요')
  return a
}

/**
 * 신체 정보 저장 — 온보딩 2단계와 마이 > 신체 정보에서 같이 쓴다.
 * 키·시작 체중 + 최초 체중 기록(사람당 1개, 다시 고치면 같은 행 갱신).
 * 성별·출생연도·목표 체중·활동량은 넘긴 것만 바꾼다 (undefined = 그대로).
 */
export async function saveOnboardingBody(v: {
  heightCm: number | null
  weightKg: number
  goalKg?: number | null
  sex?: Sex | null
  birthYear?: number | null
  activity?: ActivityLevel | null
}): Promise<boolean> {
  if (!isLive) return true
  try {
    const a = requireAccount()
    const db = sb()
    const patch = {
      height_cm: v.heightCm,
      start_weight_kg: v.weightKg,
      ...(v.goalKg !== undefined && { goal_weight_kg: v.goalKg }),
      ...(v.sex !== undefined && { sex: v.sex }),
      ...(v.birthYear !== undefined && { birth_year: v.birthYear }),
      ...(v.activity !== undefined && { activity_level: v.activity }),
    }
    const h = await db.from('user_health').update(patch).eq('user_id', a.userId)
    if (h.error) throw h.error
    const base = await db.from('body_logs').select('log_id').eq('is_baseline', true).maybeSingle()
    if (base.error) throw base.error
    const b = base.data
      ? await db.from('body_logs').update({ weight_kg: v.weightKg }).eq('log_id', base.data.log_id)
      : await db.from('body_logs').insert({ measured_at: new Date().toISOString(), weight_kg: v.weightKg, is_baseline: true, source: 'MANUAL' })
    if (b.error) throw b.error
    useRecordsStore.setState({ bodyLogs: await fetchBodyLogs() })
    await setOnboardingStep(2)
    useAuthStore.setState({
      account: {
        ...a,
        heightCm: v.heightCm,
        startWeightKg: v.weightKg,
        ...(v.goalKg !== undefined && { goalWeightKg: v.goalKg }),
        ...(v.sex !== undefined && { sex: v.sex }),
        ...(v.birthYear !== undefined && { birthYear: v.birthYear }),
        ...(v.activity !== undefined && { activityLevel: v.activity }),
        onboardingStep: Math.max(a.onboardingStep, 2),
      },
    })
    return true
  } catch (e) {
    toast.error('저장하지 못했어요', { description: dbErrorMessage(e) })
    return false
  }
}

/** 신체 정보 없이 성별·출생연도만 (온보딩 2단계에서 체중을 비우고 넘어갈 때) */
export async function saveProfileBasics(v: { sex: Sex | null; birthYear: number | null }, step: number): Promise<boolean> {
  if (!isLive) return true
  try {
    const a = requireAccount()
    const r = await sb().from('user_health').update({ sex: v.sex, birth_year: v.birthYear }).eq('user_id', a.userId)
    if (r.error) throw r.error
    await setOnboardingStep(step)
    useAuthStore.setState({ account: { ...requireAccount(), sex: v.sex, birthYear: v.birthYear } })
    return true
  } catch (e) {
    toast.error('저장하지 못했어요', { description: dbErrorMessage(e) })
    return false
  }
}

/** 온보딩 3단계 저장 — 목표 체중(선택)·활동량(선택) */
export async function saveOnboardingGoal(v: { goalKg: number | null; activity: ActivityLevel | null }): Promise<boolean> {
  if (!isLive) return true
  try {
    const a = requireAccount()
    const r = await sb().from('user_health').update({ goal_weight_kg: v.goalKg, activity_level: v.activity }).eq('user_id', a.userId)
    if (r.error) throw r.error
    await setOnboardingStep(3)
    useAuthStore.setState({ account: { ...requireAccount(), goalWeightKg: v.goalKg, activityLevel: v.activity } })
    return true
  } catch (e) {
    toast.error('저장하지 못했어요', { description: dbErrorMessage(e) })
    return false
  }
}

export async function setOnboardingStep(step: number) {
  if (!isLive) return
  const a = requireAccount()
  if (a.onboardingStep >= step) return
  const r = await sb().from('users').update({ onboarding_step: step }).eq('user_id', a.userId)
  if (r.error) throw r.error
  useAuthStore.setState({ account: { ...a, onboardingStep: step } })
}

export async function saveOnboardingDose(d: FirstDoseDraft): Promise<boolean> {
  const at = combineDateTime(d)
  if (!d.medicationId || !d.doseMg || !d.site || !at) return false
  const input = {
    medicationId: d.medicationId,
    doseMg: d.doseMg,
    site: d.site,
    administeredAt: at.toISOString(),
    timeUnknown: d.timeUnknown || undefined,
    dateApproximate: d.dateApproximate || undefined,
  }
  if (!isLive) {
    useMockRecordStore.getState().addDose(input)
    return true
  }
  try {
    const saved = await insertDose(input)
    useMockRecordStore.setState((s) => ({ doses: [saved, ...s.doses] }))
    return true
  } catch (e) {
    toast.error('투약 기록을 저장하지 못했어요', { description: dbErrorMessage(e) })
    return false
  }
}

export async function completeOnboarding(choice: 'now' | 'later'): Promise<boolean> {
  const now = new Date().toISOString()
  if (isLive) {
    try {
      const a = requireAccount()
      const r = await sb().from('users').update({ onboarding_step: 4, onboarding_completed_at: now }).eq('user_id', a.userId)
      if (r.error) throw r.error
      useAuthStore.setState({ account: { ...a, onboardingStep: 4, onboardingCompletedAt: now } })
    } catch (e) {
      toast.error('저장하지 못했어요', { description: dbErrorMessage(e) })
      return false
    }
  }
  useOnboardingStore.getState().set({ doseChoice: choice, completedAt: now })
  return true
}

/** 목업: 예시 사용자 데이터로 되돌리기 */
export function resetToDemoUser() {
  useOnboardingStore.getState().reset()
  useMockRecordStore.setState({ doses: MOCK_DOSES })
  useRecordsStore.setState({ bodyLogs: MOCK_BODY_LOGS, symptoms: MOCK_SYMPTOMS, daily: [] })
  useIntakeStore.getState().resetDemo()
  useMealStore.getState().resetDemo()
}
