import { toast } from 'sonner'
import { create } from 'zustand'

import { MOCK_TODAY_CHECK } from '@/fixtures/records.mock'
import { dbErrorMessage, isLive } from '@/lib/supabase'
import { deleteIntakeItem, deleteIntakeLog, insertIntakeItem, insertIntakeLog, updateIntakeReminder } from '@/services/live/records'

/**
 * 케어(물·영양제·복용약) — 목업 상태.
 * 기존 DAILY_CHECKS.waterCups(컵 단위) 기록을 mL로 환산해 이어 쓴다 (1컵 = 250mL).
 * GLP-1 주사(마운자로·위고비·에페)는 여기서 다루지 않고 '투약' 기능에서 기록한다.
 * 실서비스: intake_items · intake_logs 에 저장. 화면은 먼저 반영하고(빠른 반응), 저장에 실패하면 되돌리고 알린다.
 * 복용약(medicine)은 민감정보 → 동의가 없으면 DB(RLS)가 거절한다.
 */
export const ML_PER_CUP = 250
/** 목표를 정하지 않았을 때 화면에 쓰는 기본값 (8컵). 저장되지 않으며 추천값이 아님 */
export const DEFAULT_WATER_GOAL_ML = 8 * ML_PER_CUP

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
  /** 매일 알림 (요일 없이 매일) */
  remindEnabled?: boolean
  /** 알림 시각 '시' (0~23) */
  remindHour?: number | null
  /** 첫 섭취 완료 때 알림 여부를 이미 물어봤는지 */
  remindAsked?: boolean
}
export interface IntakeLog {
  id: string
  itemId: string
  at: string
  /** 먹었어요 / 건너뛰었어요 (없으면 먹었어요) */
  status?: 'taken' | 'skipped'
}

interface IntakeState {
  water: WaterLog[]
  waterGoalMl: number
  /** 하루 단백질 목표(g). 직접 정한 값만, 없으면 null (앱이 추천하지 않음) */
  proteinGoalG: number | null
  /** 하루 열량·탄수화물·지방 목표 (직접 정한 값만) */
  kcalGoal: number | null
  carbGoalG: number | null
  fatGoalG: number | null
  items: IntakeItem[]
  logs: IntakeLog[]
  addWater: (ml: number) => void
  removeWater: (id: string) => void
  addItem: (kind: IntakeKind, name: string) => void
  removeItem: (id: string) => void
  logItem: (itemId: string, at: string, status?: 'taken' | 'skipped') => void
  setReminder: (itemId: string, patch: { enabled?: boolean; hour?: number | null; asked?: boolean }) => void
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
  proteinGoalG: MOCK_TODAY_CHECK.proteinGoalG as number | null,
  kcalGoal: null as number | null,
  carbGoalG: null as number | null,
  fatGoalG: null as number | null,
  items: [{ id: 'sup-1', kind: 'supplement' as const, name: '종합비타민 (예시)' }],
  logs: MOCK_TODAY_CHECK.supplementTaken ? [{ id: 'log-1', itemId: 'sup-1', at: todayAt(8, 30) }] : [],
})

let seq = 0
const uid = (p: string) => `${p}-${Date.now()}-${seq++}`

/**
 * 화면용 임시 id → DB 가 준 진짜 id.
 * 화면은 저장을 기다리지 않고 먼저 바뀌므로, 저장이 끝나기 전에 '기록'·'삭제'를 누르면 임시 id 가 DB 로 갈 수 있다.
 * (클라우드처럼 응답이 느릴 때 실제로 발생) → 진짜 id 가 나올 때까지 기다렸다가 보낸다.
 */
const pendingIds = new Map<string, Promise<string>>()
const track = (tempId: string, p: Promise<string>) => {
  pendingIds.set(tempId, p)
  p.catch(() => {}).finally(() => setTimeout(() => pendingIds.delete(tempId), 60_000))
  return p
}
const realId = (id: string) => pendingIds.get(id) ?? Promise.resolve(id)

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
      () => track(w.id, insertIntakeLog({ kind: 'water', amount_ml: ml, taken_at: w.at })),
      () => set((s) => ({ water: s.water.filter((x) => x.id !== w.id) })),
      (dbId) => set((s) => ({ water: s.water.map((x) => (x.id === w.id ? { ...x, id: dbId } : x)) })),
    )
  },
  removeWater: (id) => {
    const prev = get().water
    set((s) => ({ water: s.water.filter((w) => w.id !== id) }))
    persist(async () => deleteIntakeLog(await realId(id)), () => set({ water: prev }))
  },
  addItem: (kind, name) => {
    const item = { id: uid(kind), kind, name }
    set((s) => ({ items: [...s.items, item] }))
    persist(
      () => track(item.id, insertIntakeItem(kind, name)),
      () => set((s) => ({ items: s.items.filter((x) => x.id !== item.id) })),
      (dbId) => set((s) => ({ items: s.items.map((x) => (x.id === item.id ? { ...x, id: dbId } : x)), logs: s.logs.map((l) => (l.itemId === item.id ? { ...l, itemId: dbId } : l)) })),
    )
  },
  removeItem: (id) => {
    const prev = { items: get().items, logs: get().logs }
    set((s) => ({ items: s.items.filter((i) => i.id !== id), logs: s.logs.filter((l) => l.itemId !== id) }))
    persist(async () => deleteIntakeItem(await realId(id)), () => set(prev))
  },
  logItem: (itemId, at, status = 'taken') => {
    const log = { id: uid('l'), itemId, at, status }
    const kind = get().items.find((i) => i.id === itemId)?.kind ?? 'supplement'
    set((s) => ({ logs: [...s.logs, log] }))
    persist(
      () => track(log.id, realId(itemId).then((id) => insertIntakeLog({ kind, item_id: id, taken_at: at, status }))),
      () => set((s) => ({ logs: s.logs.filter((x) => x.id !== log.id) })),
      (dbId) => set((s) => ({ logs: s.logs.map((x) => (x.id === log.id ? { ...x, id: dbId } : x)) })),
    )
  },
  setReminder: (itemId, patch) => {
    const prev = get().items
    set((s) => ({
      items: s.items.map((i) =>
        i.id === itemId
          ? { ...i, remindEnabled: patch.enabled ?? i.remindEnabled, remindHour: patch.hour !== undefined ? patch.hour : i.remindHour, remindAsked: patch.asked ?? i.remindAsked }
          : i,
      ),
    }))
    persist(
      async () =>
        updateIntakeReminder(await realId(itemId), {
          ...(patch.enabled !== undefined ? { remind_enabled: patch.enabled } : {}),
          ...(patch.hour !== undefined ? { remind_hour: patch.hour } : {}),
          ...(patch.asked !== undefined ? { remind_asked: patch.asked } : {}),
        }),
      () => set({ items: prev }),
    )
  },
  unlog: (logId) => {
    const prev = get().logs
    set((s) => ({ logs: s.logs.filter((l) => l.id !== logId) }))
    persist(async () => deleteIntakeLog(await realId(logId)), () => set({ logs: prev }))
  },
  resetEmpty: () => set({ water: [], items: [], logs: [], waterGoalMl: DEFAULT_WATER_GOAL_ML, proteinGoalG: null, kcalGoal: null, carbGoalG: null, fatGoalG: null }),
  resetDemo: () => set(demo()),
}))

const isToday = (iso: string) => new Date(iso).toDateString() === new Date().toDateString()

/** 홈 카드용 요약 — 실제 기록만 센다 */
export function summarizeIntake(s: Pick<IntakeState, 'water' | 'logs'>) {
  const ml = s.water.filter((w) => isToday(w.at)).reduce((a, w) => a + w.ml, 0)
  const taken = s.logs.filter((l) => isToday(l.at) && l.status !== 'skipped').length
  return { ml, taken }
}

export function formatMl(ml: number) {
  return ml >= 1000 ? `${(ml / 1000).toFixed(ml % 1000 === 0 ? 0 : 1)}L` : `${ml}mL`
}
