import { toast } from 'sonner'
import { create } from 'zustand'

import { MOCK_TODAY_CHECK } from '@/fixtures/records.mock'
import { dbErrorMessage, isLive } from '@/lib/supabase'
import { deleteIntakeItem, deleteIntakeLog, insertIntakeItem, insertIntakeLog } from '@/services/live/records'

/**
 * 섭취 관리(물·영양제·복용약) — 목업 상태.
 * 기존 DAILY_CHECKS.waterCups(컵 단위) 기록을 mL로 환산해 이어 쓴다 (1컵 = 250mL).
 * GLP-1 주사(마운자로·위고비·에페)는 여기서 다루지 않고 '투약' 기능에서 기록한다.
 * 실서비스: intake_items · intake_logs 에 저장. 화면은 먼저 반영하고(빠른 반응), 저장에 실패하면 되돌리고 알린다.
 * 복용약(medicine)은 민감정보 → 동의가 없으면 DB(RLS)가 거절한다.
 */
export const ML_PER_CUP = 250

export type IntakeKind = 'supplement' | 'medicine'

export interface WaterLog {
  id: string
  ml: number
  at: string
  /** 기존 컵 단위 기록을 환산한 항목 */
  legacy?: boolean
}
export interface IntakeItem {
  id: string
  kind: IntakeKind
  name: string
}
export interface IntakeLog {
  id: string
  itemId: string
  at: string
}

interface IntakeState {
  water: WaterLog[]
  waterGoalMl: number
  items: IntakeItem[]
  logs: IntakeLog[]
  addWater: (ml: number) => void
  removeWater: (id: string) => void
  addItem: (kind: IntakeKind, name: string) => void
  removeItem: (id: string) => void
  logItem: (itemId: string, at: string) => void
  unlog: (logId: string) => void
  resetEmpty: () => void
  resetDemo: () => void
}

const todayAt = (h: number, m: number) => {
  const d = new Date()
  d.setHours(h, m, 0, 0)
  return d.toISOString()
}

/** 예시 사용자: 기존 fixtures(물 6컵, 영양제 복용함)를 그대로 옮긴 값 */
const demo = () => ({
  water: MOCK_TODAY_CHECK.waterCups
    ? [{ id: 'legacy-water', ml: MOCK_TODAY_CHECK.waterCups * ML_PER_CUP, at: todayAt(8, 0), legacy: true }]
    : [],
  waterGoalMl: MOCK_TODAY_CHECK.waterGoalCups * ML_PER_CUP,
  items: [{ id: 'sup-1', kind: 'supplement' as const, name: '종합비타민 (예시)' }],
  logs: MOCK_TODAY_CHECK.supplementTaken ? [{ id: 'log-1', itemId: 'sup-1', at: todayAt(8, 30) }] : [],
})

let seq = 0
const uid = (p: string) => `${p}-${Date.now()}-${seq++}`

/** 실서비스 저장: 실패하면 화면 변경을 되돌린다 */
function persist<T>(run: () => Promise<T>, undo: () => void, onOk?: (v: T) => void) {
  if (!isLive) return
  run()
    .then((v) => onOk?.(v))
    .catch((e) => {
      undo()
      toast.error('저장하지 못했어요', { description: dbErrorMessage(e) })
    })
}

export const useIntakeStore = create<IntakeState>((set, get) => ({
  ...demo(),
  addWater: (ml) => {
    const w = { id: uid('w'), ml, at: new Date().toISOString() }
    set((s) => ({ water: [...s.water, w] }))
    persist(
      () => insertIntakeLog({ kind: 'water', amount_ml: ml, taken_at: w.at }),
      () => set((s) => ({ water: s.water.filter((x) => x.id !== w.id) })),
      (dbId) => set((s) => ({ water: s.water.map((x) => (x.id === w.id ? { ...x, id: dbId } : x)) })),
    )
  },
  removeWater: (id) => {
    const prev = get().water
    set((s) => ({ water: s.water.filter((w) => w.id !== id) }))
    persist(() => deleteIntakeLog(id), () => set({ water: prev }))
  },
  addItem: (kind, name) => {
    const item = { id: uid(kind), kind, name }
    set((s) => ({ items: [...s.items, item] }))
    persist(
      () => insertIntakeItem(kind, name),
      () => set((s) => ({ items: s.items.filter((x) => x.id !== item.id) })),
      (dbId) => set((s) => ({ items: s.items.map((x) => (x.id === item.id ? { ...x, id: dbId } : x)), logs: s.logs.map((l) => (l.itemId === item.id ? { ...l, itemId: dbId } : l)) })),
    )
  },
  removeItem: (id) => {
    const prev = { items: get().items, logs: get().logs }
    set((s) => ({ items: s.items.filter((i) => i.id !== id), logs: s.logs.filter((l) => l.itemId !== id) }))
    persist(() => deleteIntakeItem(id), () => set(prev))
  },
  logItem: (itemId, at) => {
    const log = { id: uid('l'), itemId, at }
    const kind = get().items.find((i) => i.id === itemId)?.kind ?? 'supplement'
    set((s) => ({ logs: [...s.logs, log] }))
    persist(
      () => insertIntakeLog({ kind, item_id: itemId, taken_at: at }),
      () => set((s) => ({ logs: s.logs.filter((x) => x.id !== log.id) })),
      (dbId) => set((s) => ({ logs: s.logs.map((x) => (x.id === log.id ? { ...x, id: dbId } : x)) })),
    )
  },
  unlog: (logId) => {
    const prev = get().logs
    set((s) => ({ logs: s.logs.filter((l) => l.id !== logId) }))
    persist(() => deleteIntakeLog(logId), () => set({ logs: prev }))
  },
  resetEmpty: () => set({ water: [], items: [], logs: [], waterGoalMl: MOCK_TODAY_CHECK.waterGoalCups * ML_PER_CUP }),
  resetDemo: () => set(demo()),
}))

const isToday = (iso: string) => new Date(iso).toDateString() === new Date().toDateString()

/** 홈 카드용 요약 — 실제 기록만 센다 */
export function summarizeIntake(s: Pick<IntakeState, 'water' | 'logs'>) {
  const ml = s.water.filter((w) => isToday(w.at)).reduce((a, w) => a + w.ml, 0)
  const taken = s.logs.filter((l) => isToday(l.at)).length
  return { ml, taken }
}

export function formatMl(ml: number) {
  return ml >= 1000 ? `${(ml / 1000).toFixed(ml % 1000 === 0 ? 0 : 1)}L` : `${ml}mL`
}
