import { isLive } from '@/lib/supabase'
import { deleteBodyLog, insertBodyLog, updateBodyLog, type BodyInput } from '@/services/live/records'
import { useRecordsStore, type BodyEntry } from '@/stores/recordsStore'

/** 체중·체성분 기록 — 실서비스면 DB, 목업이면 화면 메모리 */
export const sortBody = (list: BodyEntry[]) => [...list].sort((a, b) => a.measuredAt.localeCompare(b.measuredAt))

export function useBodyLogs() {
  return sortBody(useRecordsStore((s) => s.bodyLogs))
}

export type { BodyInput }

/** 화면에서 먼저 막는 검사 (DB 제약과 같은 범위) */
export function validateBody(b: Partial<BodyInput>): { field: keyof BodyInput; message: string } | null {
  if (!b.measuredAt) return { field: 'measuredAt', message: '측정 날짜를 입력해 주세요.' }
  if (new Date(b.measuredAt).getTime() > Date.now() + 60_000) return { field: 'measuredAt', message: '미래 날짜는 기록할 수 없어요.' }
  if (b.weightKg === undefined || b.weightKg === null || Number.isNaN(b.weightKg)) return { field: 'weightKg', message: '체중을 입력해 주세요.' }
  if (b.weightKg < 20 || b.weightKg > 300) return { field: 'weightKg', message: '20~300kg 사이로 입력해 주세요.' }
  if (b.skeletalMuscleKg !== undefined && (b.skeletalMuscleKg <= 0 || b.skeletalMuscleKg >= b.weightKg))
    return { field: 'skeletalMuscleKg', message: '골격근량은 체중보다 작아야 해요.' }
  if (b.bodyFatKg !== undefined && (b.bodyFatKg < 0 || b.bodyFatKg >= b.weightKg)) return { field: 'bodyFatKg', message: '체지방량은 체중보다 작아야 해요.' }
  if (b.bodyFatPct !== undefined && (b.bodyFatPct < 2 || b.bodyFatPct > 75)) return { field: 'bodyFatPct', message: '체지방률은 2~75% 사이예요.' }
  if (b.bodyFatKg !== undefined && b.bodyFatPct !== undefined && Math.abs((b.bodyFatKg / b.weightKg) * 100 - b.bodyFatPct) > 1)
    return { field: 'bodyFatPct', message: '체지방량 ÷ 체중과 체지방률이 1% 넘게 달라요. 결과지를 다시 확인해 주세요.' }
  return null
}

/** 10분 안에 0.1kg 이하 차이로 이미 기록이 있으면 중복 의심 (계획서 6.6) */
export function findLikelyDuplicate(b: BodyInput, list: BodyEntry[], exceptId?: string) {
  const t = new Date(b.measuredAt).getTime()
  return list.find((x) => x.id !== exceptId && Math.abs(new Date(x.measuredAt).getTime() - t) <= 10 * 60_000 && Math.abs(x.weightKg - b.weightKg) <= 0.1)
}

export async function addBody(b: BodyInput): Promise<BodyEntry> {
  const saved: BodyEntry = isLive ? await insertBodyLog(b) : { ...b, id: `local-${Date.now()}`, source: 'MANUAL', isVerified: false }
  useRecordsStore.setState((s) => ({ bodyLogs: [...s.bodyLogs, saved] }))
  return saved
}

export async function editBody(id: string, b: BodyInput) {
  const cur = useRecordsStore.getState().bodyLogs.find((x) => x.id === id)
  const saved: BodyEntry = isLive ? await updateBodyLog(id, b) : { ...cur!, ...b }
  useRecordsStore.setState((s) => ({ bodyLogs: s.bodyLogs.map((x) => (x.id === id ? saved : x)) }))
}

export async function removeBody(id: string) {
  if (isLive) await deleteBodyLog(id)
  useRecordsStore.setState((s) => ({ bodyLogs: s.bodyLogs.filter((x) => x.id !== id) }))
}
