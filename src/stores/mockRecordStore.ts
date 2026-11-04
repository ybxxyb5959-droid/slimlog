import { create } from 'zustand'

import { MOCK_DOSES } from '@/fixtures/records.mock'
import type { Dose } from '@/types/domain'

/**
 * 목업 단계 전용: 저장 버튼을 누르면 이 화면 상태에만 반영된다.
 * 새로고침하면 사라진다. 서버 연결 시 services가 API를 호출하도록 교체.
 */
interface MockRecordState {
  doses: Dose[]
  addDose: (dose: Omit<Dose, 'id'>) => Dose
  updateDose: (dose: Dose) => void
  removeDose: (id: string) => void
}

export const useMockRecordStore = create<MockRecordState>((set) => ({
  doses: MOCK_DOSES,
  addDose: (input) => {
    const dose = { ...input, id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}` }
    set((s) => ({ doses: [...s.doses, dose] }))
    return dose
  },
  updateDose: (dose) => set((s) => ({ doses: s.doses.map((d) => (d.id === dose.id ? dose : d)) })),
  removeDose: (id) => set((s) => ({ doses: s.doses.filter((d) => d.id !== id) })),
}))
