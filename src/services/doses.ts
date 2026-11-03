import { useMockRecordStore } from '@/stores/mockRecordStore'
import type { Dose } from '@/types/domain'

/**
 * 투약 기록 서비스 — 연결 예정 API: GET·POST /doses, GET /residual-curve
 * 지금은 목업 스토어(화면 상태)에만 반영한다.
 */
export function useDoses() {
  const doses = useMockRecordStore((s) => s.doses)
  return [...doses].sort((a, b) => b.administeredAt.localeCompare(a.administeredAt))
}

export function useDose(id: string | undefined) {
  return useMockRecordStore((s) => s.doses.find((d) => d.id === id))
}

export type DoseInput = Omit<Dose, 'id'>

/** 서버 검증 규칙(계획서 7.3) 중 화면에서 미리 막을 수 있는 것: 미래·음수 투약 */
export function validateDose(input: Partial<DoseInput>): { field: keyof DoseInput; message: string } | null {
  if (!input.medicationId) return { field: 'medicationId', message: '약을 선택해 주세요.' }
  if (!input.doseMg || input.doseMg <= 0) return { field: 'doseMg', message: '처방받은 용량을 입력해 주세요.' }
  if (!input.administeredAt) return { field: 'administeredAt', message: '투약 일시를 입력해 주세요.' }
  if (new Date(input.administeredAt).getTime() > Date.now() + 60_000)
    return { field: 'administeredAt', message: '미래 날짜는 기록할 수 없어요.' }
  if (!input.site) return { field: 'site', message: '주사 부위를 선택해 주세요.' }
  return null
}

export function saveDoseMock(input: DoseInput) {
  return useMockRecordStore.getState().addDose(input)
}

export function updateDoseMock(dose: Dose) {
  useMockRecordStore.getState().updateDose(dose)
}

export function removeDoseMock(id: string) {
  useMockRecordStore.getState().removeDose(id)
}
