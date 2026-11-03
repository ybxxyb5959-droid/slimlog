import {
  MOCK_BODY_LOGS,
  MOCK_PROFILE,
  MOCK_SYMPTOMS,
  MOCK_TIMELINE,
  MOCK_TODAY_CHECK,
  MOCK_TODAY_MEALS,
  MOCK_WEEKLY_STATUS,
} from '@/fixtures/records.mock'

import { mockResponse } from './mock'

/**
 * 기록 조회 서비스 — 현재는 fixtures를 돌려준다.
 * 연결 예정 API: GET /body-logs, GET /timeline?from&to&types, PUT /daily-checks/{date}
 */
export function getHomeSummary() {
  return mockResponse({
    profile: MOCK_PROFILE,
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
