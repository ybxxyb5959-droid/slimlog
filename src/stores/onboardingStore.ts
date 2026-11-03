import { create } from 'zustand'
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware'

/**
 * 온보딩 진행 상태 — 앱을 껐다 켜도 이어서 할 수 있게 저장한다.
 * 목업: localStorage / 실제: PROFILES.onboarding_step, onboarding_completed_at (사용자별, RLS)
 * 건강 정보(키·체중)와 공개 정보(닉네임)는 서버에서 서로 다른 테이블에 저장한다.
 */
export type OnboardingStep = 'nickname' | 'body' | 'medication'

export interface OnboardingState {
  step: OnboardingStep
  nickname: string
  nicknameSaved: boolean
  heightCm: string
  weightKg: string
  goalKg: string
  bodySkipped: boolean
  /** STEP 2 저장 시각 — 최초 체중 기록이 중복 저장되지 않게 한 번만 만든다 */
  baselineSavedAt: string | null
  doseChoice: 'now' | 'later' | null
  completedAt: string | null
  set: (patch: Partial<Omit<OnboardingState, 'set' | 'reset'>>) => void
  reset: () => void
}

const safeStorage: StateStorage = {
  getItem: (k) => {
    try {
      return window.localStorage.getItem(k)
    } catch {
      return null
    }
  },
  setItem: (k, v) => {
    try {
      window.localStorage.setItem(k, v)
    } catch {
      /* 저장 실패 시 이번 세션에만 유지 */
    }
  },
  removeItem: (k) => {
    try {
      window.localStorage.removeItem(k)
    } catch {
      /* noop */
    }
  },
}

const INITIAL = {
  step: 'nickname' as OnboardingStep,
  nickname: '',
  nicknameSaved: false,
  heightCm: '',
  weightKg: '',
  goalKg: '',
  bodySkipped: false,
  baselineSavedAt: null,
  doseChoice: null,
  completedAt: null,
}

export const ONBOARDING_STORAGE_KEY = 'slimlog:onboarding:v1'

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      ...INITIAL,
      set: (patch) => set(patch),
      reset: () => set(INITIAL),
    }),
    { name: ONBOARDING_STORAGE_KEY, storage: createJSONStorage(() => safeStorage), version: 1 },
  ),
)

export const STEP_ORDER: OnboardingStep[] = ['nickname', 'body', 'medication']
