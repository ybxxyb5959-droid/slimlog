import { MOCK_PROFILE } from '@/fixtures/records.mock'
import { parseMeasure, RANGES } from '@/lib/measure'
import { useOnboardingStore } from '@/stores/onboardingStore'

import { isNewUser } from './session'

/** 마이페이지용 프로필 — 새 사용자면 온보딩 입력값, 아니면 예시 사용자 */
export function useMyProfile() {
  const o = useOnboardingStore()
  if (isNewUser()) {
    return {
      nickname: o.nickname,
      heightCm: parseMeasure(o.heightCm, RANGES.height.min, RANGES.height.max, 'cm').value,
      startWeightKg: parseMeasure(o.weightKg, RANGES.weight.min, RANGES.weight.max, 'kg').value,
      goalWeightKg: parseMeasure(o.goalKg, RANGES.weight.min, RANGES.weight.max, 'kg').value,
      medicationId: MOCK_PROFILE.medicationId,
      isExample: false,
    }
  }
  return {
    nickname: MOCK_PROFILE.nickname,
    heightCm: 172 as number | null,
    startWeightKg: MOCK_PROFILE.startWeightKg as number | null,
    goalWeightKg: MOCK_PROFILE.goalWeightKg as number | null,
    medicationId: MOCK_PROFILE.medicationId,
    isExample: true,
  }
}
