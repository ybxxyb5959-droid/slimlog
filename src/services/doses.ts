import { isLive } from '@/lib/supabase'
import { deleteDoseRow, insertDose, updateDoseRow } from '@/services/live/account'
import { useMockRecordStore } from '@/stores/mockRecordStore'
import type { Dose } from '@/types/domain'

/**
 * 투약 기록 서비스
 * - 실서비스: Supabase doses 테이블 (RLS: 본인 + 민감정보 동의) 에 저장한 뒤 화면 스토어 갱신
 * - 목업: 화면 스토어에만 반영 (새로고침하면 사라짐)
 * 화면 스토어(useMockRecordStore)는 두 모드 모두에서 '화면에 보이는 목록' 캐시 역할을 한다.
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

export async function saveDose(input: DoseInput): Promise<Dose> {
  if (!isLive) return useMockRecordStore.getState().addDose(input)
  const saved = await insertDose(input)
  useMockRecordStore.setState((s) => ({ doses: [saved, ...s.doses] }))
  return saved
}

export async function updateDose(dose: Dose): Promise<void> {
  const saved = isLive ? await updateDoseRow(dose) : dose
  useMockRecordStore.getState().updateDose(saved)
}

export async function removeDose(id: string): Promise<void> {
  if (isLive) await deleteDoseRow(id)
  useMockRecordStore.getState().removeDose(id)
}

/** 저장 결과 안내 문구 — 목업이면 서버에 저장되지 않는다는 걸 분명히 */
export const savedNote = () => (isLive ? undefined : '목업 · 새로고침하면 사라지며 서버에 저장되지 않아요.')
