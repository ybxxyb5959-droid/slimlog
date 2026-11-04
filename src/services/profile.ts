import { MOCK_PROFILE } from '@/fixtures/records.mock'
import { parseBirthYear, type ActivityLevel, type Sex } from '@/lib/bodyProfile'
import { parseMeasure, RANGES } from '@/lib/measure'
import { isLive } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { useOnboardingStore } from '@/stores/onboardingStore'
import type { MedicationId } from '@/types/domain'

import { isNewUser } from './session'

/** 마이페이지용 프로필 — 새 사용자면 온보딩 입력값, 아니면 예시 사용자 */
export function useMyProfile() {
  const o = useOnboardingStore()
  const account = useAuthStore((s) => s.account)
  if (isLive) {
    return {
      nickname: account?.nickname ?? '',
      heightCm: account?.heightCm ?? null,
      startWeightKg: account?.startWeightKg ?? null,
      goalWeightKg: account?.goalWeightKg ?? null,
      medicationId: (account?.currentMedId ?? null) as MedicationId | null,
      sex: account?.sex ?? null,
      birthYear: account?.birthYear ?? null,
      activity: account?.activityLevel ?? null,
      isExample: false,
    }
  }
  if (isNewUser()) {
    return {
      nickname: o.nickname,
      heightCm: parseMeasure(o.heightCm, RANGES.height.min, RANGES.height.max, 'cm').value,
      startWeightKg: parseMeasure(o.weightKg, RANGES.weight.min, RANGES.weight.max, 'kg').value,
      goalWeightKg: parseMeasure(o.goalKg, RANGES.weight.min, RANGES.weight.max, 'kg').value,
      medicationId: (o.currentMedId ?? MOCK_PROFILE.medicationId) as MedicationId | null,
      sex: o.sex,
      birthYear: parseBirthYear(o.birthYear).value,
      activity: o.activity,
      isExample: false,
    }
  }
  return {
    nickname: MOCK_PROFILE.nickname,
    heightCm: 172 as number | null,
    startWeightKg: MOCK_PROFILE.startWeightKg as number | null,
    goalWeightKg: MOCK_PROFILE.goalWeightKg as number | null,
    medicationId: (o.currentMedId ?? MOCK_PROFILE.medicationId) as MedicationId | null,
    // 예시 사용자 — 참고 계산 화면을 보여 주기 위한 예시 값
    sex: 'female' as Sex | null,
    birthYear: 1992 as number | null,
    activity: 'light' as ActivityLevel | null,
    isExample: true,
  }
}

/**
 * 사용 중인 약 바꾸기 — 투약 중 약을 바꿨을 때(마OOO↔위OO 등) 투약 기록 저장 뒤 호출.
 * 실서비스: 민감정보 동의가 있을 때만 user_health.current_med_id 저장 (동의 없으면 투약 기록만 남음)
 */
export async function setCurrentMedication(medId: MedicationId): Promise<void> {
  if (!isLive) return useOnboardingStore.getState().set({ currentMedId: medId })
  const account = useAuthStore.getState().account
  if (!account || account.currentMedId === medId || !account.consents.includes('sensitive')) return
  const { updateHealth } = await import('./live/account')
  await updateHealth(account.userId, { current_med_id: medId })
  useAuthStore.setState({ account: { ...account, currentMedId: medId } })
}
