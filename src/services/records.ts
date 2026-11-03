import {
  MOCK_BODY_LOGS,
  MOCK_PROFILE,
  MOCK_SYMPTOMS,
  MOCK_TIMELINE,
  MOCK_TODAY_CHECK,
  MOCK_TODAY_MEALS,
  MOCK_WEEKLY_STATUS,
} from '@/fixtures/records.mock'

import { parseMeasure, RANGES } from '@/lib/measure'
import { useOnboardingStore } from '@/stores/onboardingStore'

import { mockResponse } from './mock'
import { isNewUser } from './session'

/**
 * 기록 조회 서비스 — 현재는 fixtures를 돌려준다.
 * 연결 예정 API: GET /body-logs, GET /timeline?from&to&types, PUT /daily-checks/{date}
 */
export interface HomeSummary {
  profile: { nickname: string; startWeightKg: number | null; goalWeightKg: number | null }
  bodyLogs: typeof MOCK_BODY_LOGS
  todayMeals: typeof MOCK_TODAY_MEALS
  todayCheck: typeof MOCK_TODAY_CHECK
  symptoms: typeof MOCK_SYMPTOMS
  timeline: typeof MOCK_TIMELINE
  weeklyStatus: typeof MOCK_WEEKLY_STATUS
  /** 온보딩을 막 마친 새 사용자 — 본인이 입력한 것만 */
  isNewUser: boolean
}

export function getHomeSummary(): Promise<HomeSummary> {
  if (isNewUser()) {
    const o = useOnboardingStore.getState()
    const w = o.bodySkipped ? null : parseMeasure(o.weightKg, RANGES.weight.min, RANGES.weight.max, 'kg').value
    const g = o.bodySkipped ? null : parseMeasure(o.goalKg, RANGES.weight.min, RANGES.weight.max, 'kg').value
    return mockResponse({
      profile: { nickname: o.nickname, startWeightKg: w, goalWeightKg: g },
      // 최초 체중 1건만 (온보딩 입력값) — 감량량·그래프를 만들지 않는다
      bodyLogs: w !== null ? [{ id: 'baseline', measuredAt: o.baselineSavedAt ?? new Date().toISOString(), weightKg: w, source: 'MANUAL' as const, isVerified: true }] : [],
      todayMeals: [],
      todayCheck: { ...MOCK_TODAY_CHECK, waterCups: 0, proteinG: 0, supplementTaken: false },
      symptoms: [],
      timeline: [],
      weeklyStatus: [],
      isNewUser: true,
    })
  }
  return mockResponse({
    isNewUser: false,
    profile: { nickname: MOCK_PROFILE.nickname, startWeightKg: MOCK_PROFILE.startWeightKg, goalWeightKg: MOCK_PROFILE.goalWeightKg },
    bodyLogs: MOCK_BODY_LOGS,
    todayMeals: MOCK_TODAY_MEALS,
    todayCheck: MOCK_TODAY_CHECK,
    symptoms: MOCK_SYMPTOMS,
    timeline: MOCK_TIMELINE.slice(-7),
    weeklyStatus: MOCK_WEEKLY_STATUS,
  })
}

export function getBodyLogs() {
  return mockResponse(MOCK_BODY_LOGS)
}

export function getTimeline(days: number) {
  return mockResponse(MOCK_TIMELINE.slice(-days))
}

export function getSymptoms() {
  return mockResponse(MOCK_SYMPTOMS)
}
