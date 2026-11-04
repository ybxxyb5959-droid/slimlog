import type { Session } from '@supabase/supabase-js'
import { create } from 'zustand'

import { isLive, supabase } from '@/lib/supabase'
import { fetchDoses, loadAccount, type LiveAccount } from '@/services/live/account'
import { fetchFoodsByIds, fetchMeals, fetchMyFoods } from '@/services/live/meals'
import { fetchBodyLogs, fetchDailyChecks, fetchIntake, fetchSymptoms } from '@/services/live/records'
import { cacheFoods, useFoodCache } from '@/services/foodCatalog'
import { DEFAULT_WATER_GOAL_ML, useIntakeStore } from '@/stores/intakeStore'
import { loadFavorites, setFavoritesUser, useMealStore } from '@/stores/mealStore'
import { useMockRecordStore } from '@/stores/mockRecordStore'
import { useOnboardingStore, type OnboardingStep } from '@/stores/onboardingStore'
import { useRecordsStore } from '@/stores/recordsStore'

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

const STEP_BY_NUMBER: OnboardingStep[] = ['nickname', 'body', 'goal', 'medication']

/** 서버 상태를 화면용 스토어에 채운다. 예시(목업) 데이터는 비운다 */
async function hydrate(account: LiveAccount) {
  const fmt = (n: number | null) => (n === null ? '' : String(Number(n)))
  useOnboardingStore.setState({
    name: account.legalName ?? '',
    nickname: account.nickname ?? '',
    nicknameSaved: !!account.nickname,
    sex: account.sex,
    birthYear: account.birthYear === null ? '' : String(account.birthYear),
    activity: account.activityLevel,
    heightCm: fmt(account.heightCm),
    weightKg: fmt(account.startWeightKg),
    goalKg: fmt(account.goalWeightKg),
    baselineSavedAt: account.startWeightKg !== null ? 'server' : null,
    step: STEP_BY_NUMBER[Math.min(account.onboardingStep, 3)] ?? 'nickname',
    completedAt: account.onboardingCompletedAt,
  })
  // 식단: 최근 60일 식사 + 내 음식 + 기록에 쓰인 공용 음식(섭취량 단위 표시용)
  const [meals, myFoods] = await Promise.all([fetchMeals(), fetchMyFoods(account.userId)])
  setFavoritesUser(account.userId)
  useMealStore.setState({ records: meals, customFoods: myFoods, favorites: loadFavorites(account.userId) })
  useFoodCache.setState({ foods: [] })
  const usedIds = [...new Set(meals.flatMap((m) => m.items.map((i) => i.foodId)).filter((id) => id && !myFoods.some((f) => f.id === id)))]
  cacheFoods(await fetchFoodsByIds(usedIds))
  // 케어 (물·영양제는 일반, 복용약은 RLS 로 동의자만)
  const intake = await fetchIntake()
  useIntakeStore.setState({
    waterGoalMl: account.waterGoalMl ?? DEFAULT_WATER_GOAL_ML,
    proteinGoalG: account.proteinGoalG,
    kcalGoal: account.kcalGoal,
    carbGoalG: account.carbGoalG,
    fatGoalG: account.fatGoalG,
    water: intake.logs.filter((l) => l.kind === 'water').map((l) => ({ id: l.log_id, ml: l.amount_ml ?? 0, at: l.taken_at })),
    items: intake.items.map((i) => ({ id: i.item_id, kind: i.kind as 'supplement' | 'medicine', name: i.name, remindEnabled: i.remind_enabled, remindHour: i.remind_hour, remindAsked: i.remind_asked })),
    logs: intake.logs.filter((l) => l.kind !== 'water' && l.item_id).map((l) => ({ id: l.log_id, itemId: l.item_id!, at: l.taken_at, status: l.status as 'taken' | 'skipped' })),
  })
  // 민감정보(투약·체중·증상·컨디션)는 동의가 있을 때만 불러온다 (없으면 RLS 로도 0건)
  const sensitive = account.consents.includes('sensitive')
  const [doses, bodyLogs, symptoms, daily] = sensitive
    ? await Promise.all([fetchDoses(), fetchBodyLogs(), fetchSymptoms(), fetchDailyChecks()])
    : [[], [], [], []]
  useMockRecordStore.setState({ doses })
  useRecordsStore.setState({ bodyLogs, symptoms, daily })
}

function clearLocal() {
  setFavoritesUser(null)
  useFoodCache.setState({ foods: [] })
  useOnboardingStore.getState().reset()
  useMockRecordStore.setState({ doses: [] })
  useRecordsStore.setState({ bodyLogs: [], symptoms: [], daily: [] })
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
