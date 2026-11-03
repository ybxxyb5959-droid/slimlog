import { combineDateTime, type FirstDoseDraft } from '@/features/record/first-dose/firstDoseDraft'
import { MOCK_DOSES } from '@/fixtures/records.mock'
import { useIntakeStore } from '@/stores/intakeStore'
import { useMealStore } from '@/stores/mealStore'
import { useMockRecordStore } from '@/stores/mockRecordStore'
import { useOnboardingStore } from '@/stores/onboardingStore'

/**
 * 목업 사용자 세션.
 * - 예시 사용자(기본): fixtures의 6주치 기록
 * - 새 사용자: 온보딩을 마친 뒤 — 본인이 입력한 것만 보인다 (허위 감량·그래프 없음)
 */
export const isNewUser = () => !!useOnboardingStore.getState().completedAt || useOnboardingStore.getState().nicknameSaved

export function beginNewUser() {
  useMockRecordStore.setState({ doses: [] })
  useIntakeStore.getState().resetEmpty()
  useMealStore.getState().resetEmpty()
}

export function saveOnboardingDose(d: FirstDoseDraft) {
  const at = combineDateTime(d)
  if (!d.medicationId || !d.doseMg || !d.site || !at) return
  useMockRecordStore.getState().addDose({
    medicationId: d.medicationId,
    doseMg: d.doseMg,
    site: d.site,
    administeredAt: at.toISOString(),
    timeUnknown: d.timeUnknown || undefined,
    dateApproximate: d.dateApproximate || undefined,
  })
}

export function completeOnboarding(choice: 'now' | 'later') {
  useOnboardingStore.getState().set({ doseChoice: choice, completedAt: new Date().toISOString() })
}

/** 목업: 예시 사용자 데이터로 되돌리기 */
export function resetToDemoUser() {
  useOnboardingStore.getState().reset()
  useMockRecordStore.setState({ doses: MOCK_DOSES })
  useIntakeStore.getState().resetDemo()
  useMealStore.getState().resetDemo()
}
