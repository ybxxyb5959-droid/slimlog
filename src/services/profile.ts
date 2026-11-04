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
      medicationId: MOCK_PROFILE.medicationId as MedicationId | null,
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
    medicationId: MOCK_PROFILE.medicationId as MedicationId | null,
    sex: null as Sex | null,
    birthYear: null as number | null,
    activity: null as ActivityLevel | null,
    isExample: true,
  }
}
