import { isLive } from '@/lib/supabase'
import { deleteSymptom, insertSymptom, updateSymptom, upsertDailyCheck, type DailyCondition, type SymptomInput } from '@/services/live/records'
import { useAuthStore } from '@/stores/authStore'
import { useRecordsStore } from '@/stores/recordsStore'
import type { Symptom } from '@/types/domain'

/** 증상·하루 컨디션 기록. 증상과 약의 인과관계는 판단하지 않는다 (시간순으로 나란히 보여줄 뿐) */
export type { DailyCondition, SymptomInput }

export function useSymptoms() {
  const list = useRecordsStore((s) => s.symptoms)
  return [...list].sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))
}

export function validateSymptom(s: Partial<SymptomInput>): string | null {
  if (!s.type) return '어떤 증상인지 골라 주세요.'
  if (!s.severity || s.severity < 1 || s.severity > 5) return '강도를 골라 주세요.'
  if (!s.recordedAt) return '언제부터인지 입력해 주세요.'
  if (new Date(s.recordedAt).getTime() > Date.now() + 60_000) return '미래 시각은 기록할 수 없어요.'
  if (s.durationH !== undefined && s.durationH !== null && (s.durationH < 0 || s.durationH > 720)) return '지속 시간은 0~720시간이에요.'
  if (s.memo && s.memo.length > 200) return '메모는 200자까지예요.'
  return null
}

export async function addSymptom(s: SymptomInput): Promise<Symptom> {
  const saved = isLive ? await insertSymptom(s) : { ...s, id: `local-${Date.now()}` }
  useRecordsStore.setState((st) => ({ symptoms: [saved, ...st.symptoms] }))
  return saved
}
export async function editSymptom(id: string, s: SymptomInput) {
  const saved = isLive ? await updateSymptom(id, s) : { ...s, id }
  useRecordsStore.setState((st) => ({ symptoms: st.symptoms.map((x) => (x.id === id ? saved : x)) }))
}
export async function removeSymptom(id: string) {
  if (isLive) await deleteSymptom(id)
  useRecordsStore.setState((st) => ({ symptoms: st.symptoms.filter((x) => x.id !== id) }))
}

export function useDaily(date: string) {
  return useRecordsStore((s) => s.daily.find((d) => d.date === date))
}
export async function saveDaily(c: DailyCondition) {
  if (isLive) {
    const a = useAuthStore.getState().account
    if (!a) throw new Error('로그인이 필요해요')
    await upsertDailyCheck(a.userId, c)
  }
  useRecordsStore.setState((s) => ({ daily: [c, ...s.daily.filter((d) => d.date !== c.date)] }))
}
