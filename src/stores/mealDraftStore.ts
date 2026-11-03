import { create } from 'zustand'

import { toDateTimeLocalValue } from '@/lib/date'
import type { MealType } from '@/types/domain'
import type { MealItem, MealRecord } from '@/types/meal'

/**
 * 저장 전 식사(장바구니) — 사진 기록과 수동 기록이 같은 저장 화면을 쓴다.
 * foodId가 null인 항목 = '확인 필요'인데 아직 음식을 고르지 않은 사진 인식 항목 → 저장 불가.
 */
export type DraftItem = Omit<MealItem, 'foodId'> & { foodId: string | null }

export interface DraftPhoto {
  kind: 'sample' | 'file'
  url?: string
  /** 실서비스 업로드용 원본 파일 (메모리에만) */
  file?: File
}

/** 사진 인식 항목인지 (예전 영역 번호 기록도 사진 항목으로 본다) */
export const isPhotoItem = (i: { fromPhoto?: boolean; regionNo?: number }) => !!i.fromPhoto || i.regionNo !== undefined

export const defaultMealType = (d = new Date()): MealType => {
  const h = d.getHours()
  return h < 10 ? 'breakfast' : h < 15 ? 'lunch' : h < 21 ? 'dinner' : 'snack'
}

interface DraftState {
  items: DraftItem[]
  photoId: string | null
  photo: DraftPhoto | null
  mealType: MealType
  eatenAt: string // datetime-local
  editingId: string | null
  /** 서버 인식 결과 id 전체 — 사용자가 뺀 항목도 '제외'로 기록하려고 따로 보관 */
  predIds: string[]
  addItems: (items: DraftItem[], photoId?: string) => void
  replaceItem: (id: string, item: DraftItem) => void
  removeItem: (id: string) => void
  setPhoto: (photo: DraftPhoto | null) => void
  /** 사진 분석 결과로 사진 항목만 교체 (직접 추가한 음식은 유지) */
  setPhotoItems: (items: DraftItem[], photoId: string) => void
  setMeta: (patch: Partial<Pick<DraftState, 'mealType' | 'eatenAt'>>) => void
  loadRecord: (r: MealRecord) => void
  reset: () => void
}

const fresh = () => ({ items: [] as DraftItem[], photoId: null as string | null, photo: null as DraftPhoto | null, mealType: defaultMealType(), eatenAt: toDateTimeLocalValue(new Date()), editingId: null, predIds: [] as string[] })

export const useMealDraftStore = create<DraftState>((set) => ({
  ...fresh(),
  addItems: (items, photoId) => set((s) => ({ items: [...s.items, ...items], photoId: photoId ?? s.photoId })),
  replaceItem: (id, item) => set((s) => ({ items: s.items.map((x) => (x.id === id ? item : x)) })),
  removeItem: (id) => set((s) => ({ items: s.items.filter((x) => x.id !== id) })),
  setPhoto: (photo) => set({ photo }),
  setPhotoItems: (items, photoId) =>
    set((s) => ({ items: [...items, ...s.items.filter((x) => !isPhotoItem(x))], photoId, predIds: items.map((i) => i.ai?.predId).filter((x): x is string => !!x) })),
  setMeta: (patch) => set(patch),
  loadRecord: (r) =>
    set({ items: r.items, photoId: r.photoId ?? null, photo: r.photoId ? { kind: 'sample' } : null, mealType: r.mealType, eatenAt: toDateTimeLocalValue(new Date(r.eatenAt)), editingId: r.id }),
  reset: () => set(fresh()),
}))
