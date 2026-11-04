import { useEffect } from 'react'
import { Navigate, useParams } from 'react-router'

import { beginNewUser } from '@/services/session'
import { STEP_ORDER, useOnboardingStore, type OnboardingStep } from '@/stores/onboardingStore'

import { BodyStep } from './BodyStep'
import { GoalStep } from './GoalStep'
import { MedicationChoiceStep } from './MedicationChoiceStep'
import { NicknameStep } from './NicknameStep'

/**
 * /onboarding/:step — 단계마다 주소가 달라서 브라우저·Android 뒤로 가기가 이전 단계로 간다.
 * /onboarding 으로 들어오면 저장된 진행 단계로 복귀. 완료한 사용자는 홈으로.
 */
export function OnboardingRoute() {
  const { step: param } = useParams()
  const { step: saved, nicknameSaved, completedAt } = useOnboardingStore()

  // 새 사용자 시작: 예시 기록 대신 빈 기록으로
  useEffect(() => {
    if (!nicknameSaved && !completedAt) beginNewUser()
  }, [nicknameSaved, completedAt])

  if (completedAt) return <Navigate to="/home" replace />
  const step = param as OnboardingStep | undefined
  if (!step || !STEP_ORDER.includes(step)) return <Navigate to={`/onboarding/${saved}`} replace />
  // 닉네임을 확정하지 않았으면 다음 단계로 건너뛸 수 없다
  if (step !== 'nickname' && !nicknameSaved) return <Navigate to="/onboarding/nickname" replace />

  if (step === 'nickname') return <NicknameStep />
  if (step === 'body') return <BodyStep />
  if (step === 'goal') return <GoalStep />
  return <MedicationChoiceStep />
}
