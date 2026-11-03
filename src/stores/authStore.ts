import type { Session } from '@supabase/supabase-js'
import { create } from 'zustand'

import { isLive, supabase } from '@/lib/supabase'
import { fetchDoses, loadAccount, type LiveAccount } from '@/services/live/account'
import { useIntakeStore } from '@/stores/intakeStore'
import { useMealStore } from '@/stores/mealStore'
import { useMockRecordStore } from '@/stores/mockRecordStore'
import { useOnboardingStore, type OnboardingStep } from '@/stores/onboardingStore'

/**
 * 로그인 상태 (live 모드 전용)
 * - loading: 앱 시작 직후 저장된 세션을 확인하는 중
 * - signedOut / signedIn
 * account: 서버의 프로필·동의·온보딩 상태. 화면은 이것을 보고 동의 → 온보딩 → 홈으로 보낸다.
 */
type Status = 'loading' | 'signedOut' | 'signedIn' | 'error'

interface AuthState {
  status: Status
  session: Session | null
  account: LiveAccount | null
  error: string | null
  refreshAccount: () => Promise<void>
  signOut: () => Promise<void>
}

const STEP_BY_NUMBER: OnboardingStep[] = ['nickname', 'body', 'medication']

/** 서버 상태를 화면용 스토어에 채운다. 예시(목업) 데이터는 비운다 */
async function hydrate(account: LiveAccount) {
  const fmt = (n: number | null) => (n === null ? '' : String(Number(n)))
  useOnboardingStore.setState({
    name: account.legalName ?? '',
    nickname: account.nickname ?? '',
    nicknameSaved: !!account.nickname,
    heightCm: fmt(account.heightCm),
    weightKg: fmt(account.startWeightKg),
    goalKg: fmt(account.goalWeightKg),
    baselineSavedAt: account.startWeightKg !== null ? 'server' : null,
    step: STEP_BY_NUMBER[Math.min(account.onboardingStep, 2)] ?? 'nickname',
    completedAt: account.onboardingCompletedAt,
  })
  // 아직 서버에 연결하지 않은 기록(식단·섭취)은 예시 데이터 대신 빈 상태로 (Phase 2 에서 연결)
  useIntakeStore.getState().resetEmpty()
  useMealStore.getState().resetEmpty()
  const doses = account.consents.includes('sensitive') ? await fetchDoses() : []
  useMockRecordStore.setState({ doses })
}

function clearLocal() {
  useOnboardingStore.getState().reset()
  useMockRecordStore.setState({ doses: [] })
  useIntakeStore.getState().resetEmpty()
  useMealStore.getState().resetEmpty()
}

export const useAuthStore = create<AuthState>((set, get) => ({
  status: isLive ? 'loading' : 'signedOut',
  session: null,
  account: null,
  error: null,
  refreshAccount: async () => {
    const user = get().session?.user
    if (!user) return
    try {
      const account = await loadAccount(user)
      await hydrate(account)
      set({ account, status: 'signedIn', error: null })
    } catch (e) {
      set({ status: 'error', error: (e as Error).message })
    }
  },
  signOut: async () => {
    await supabase?.auth.signOut()
    clearLocal()
    set({ status: 'signedOut', session: null, account: null })
  },
}))

let started = false
/** 앱 시작 시 한 번 — 저장된 세션 확인 + 로그인/로그아웃 이벤트 구독 */
export function startAuth() {
  if (!isLive || !supabase || started) return
  started = true
  const onSession = async (session: Session | null) => {
    const prev = useAuthStore.getState().session
    if (!session) {
      if (prev) clearLocal()
      useAuthStore.setState({ status: 'signedOut', session: null, account: null })
      return
    }
    const sameUser = prev?.user.id === session.user.id && useAuthStore.getState().account
    useAuthStore.setState({ session })
    if (!sameUser) {
      useAuthStore.setState({ status: 'loading' })
      await useAuthStore.getState().refreshAccount()
    }
  }
  supabase.auth.getSession().then(({ data }) => onSession(data.session))
  supabase.auth.onAuthStateChange((event, session) => {
    // getSession 과 겹치는 INITIAL_SESSION 은 무시, 토큰 갱신은 세션만 교체
    if (event === 'INITIAL_SESSION') return
    if (event === 'TOKEN_REFRESHED') return void useAuthStore.setState({ session })
    // 콜백 안에서 Supabase 호출을 기다리면 교착될 수 있어 다음 틱에 처리
    setTimeout(() => onSession(session), 0)
  })
}
