import { create } from 'zustand'

import { MOCK_BODY_LOGS, MOCK_SYMPTOMS } from '@/fixtures/records.mock'
import type { DailyCondition } from '@/services/live/records'
import type { BodyLog, Symptom } from '@/types/domain'

/**
 * 체중·체성분 / 증상 / 하루 컨디션 — 화면에 보이는 목록 캐시
 * - 목업: 예시 데이터로 시작, 화면 메모리에만 저장
 * - 실서비스: 로그인 시 DB 에서 채우고, 저장·수정·삭제 성공 후 갱신 (services/body.ts, services/symptoms.ts)
 */
export type BodyEntry = BodyLog & { isBaseline?: boolean }

interface RecordsState {
  bodyLogs: BodyEntry[]
  symptoms: Symptom[]
  daily: DailyCondition[]
}

export const useRecordsStore = create<RecordsState>(() => ({
  bodyLogs: MOCK_BODY_LOGS,
  symptoms: MOCK_SYMPTOMS,
  daily: [],
}))
