import { createBrowserRouter, createMemoryRouter, Navigate, type RouteObject } from 'react-router'

import { AppLayout } from '@/components/layout/AppLayout'
import { ModerationPage } from '@/features/admin/ModerationPage'
import { MealListPage } from '@/features/meal/MealListPage'
import { CustomFoodPage } from '@/features/meal/CustomFoodPage'
import { FoodDetailPage } from '@/features/meal/FoodDetailPage'
import { FoodSearchPage } from '@/features/meal/FoodSearchPage'
import { MealPhotoPage } from '@/features/meal/MealPhotoPage'
import { MealReviewPage } from '@/features/meal/MealReviewPage'
import { MealStartPage } from '@/features/meal/MealStartPage'
import { OnboardingRoute } from '@/features/onboarding/OnboardingRoute'
import { AuthCallbackPage } from '@/features/auth/AuthCallbackPage'
import { ConsentSignupPage } from '@/features/auth/ConsentSignupPage'
import { LiveGate } from '@/features/auth/LiveGate'
import { LoginPage } from '@/features/auth/LoginPage'
import { SignupPage } from '@/features/auth/SignupPage'
import { CommunityListPage } from '@/features/community/CommunityListPage'
import { PostDetailPage } from '@/features/community/PostDetailPage'
import { PostWritePage } from '@/features/community/PostWritePage'
import { AccountPage } from '@/features/my/AccountPage'
import { ConsentPage } from '@/features/my/ConsentPage'
import { EyebodyDataPage } from '@/features/my/EyebodyDataPage'
import { MyPage } from '@/features/my/MyPage'
import { ProfilePage } from '@/features/my/ProfilePage'
import { AppSettingsPage } from '@/features/my/AppSettingsPage'
import { BodyGoalPage } from '@/features/my/BodyGoalPage'
import { DataManagePage } from '@/features/my/DataManagePage'
import { LikedPostsPage } from '@/features/my/LikedPostsPage'
import { NotificationSettingsPage } from '@/features/my/NotificationSettingsPage'
import { SettingsHubPage } from '@/features/my/SettingsHubPage'
import { SupportPage } from '@/features/my/SupportPage'
import { TermsPage } from '@/features/my/TermsPage'
import { AnalysisHubPage } from '@/features/analysis/AnalysisHubPage'
import { BodyChangePage, ConsultPage, NutritionPage, TimelinePage } from '@/features/analysis/AnalysisDetailPages'
import { AnalysisSection } from '@/features/analysis/AnalysisSection'
import { MedicationAnalysisPage } from '@/features/analysis/MedicationAnalysisPage'
import { ComingSoonPage } from '@/features/common/ComingSoonPage'
import { BrandPreview } from '@/features/dev/BrandPreview'
import { WeightCardGallery } from '@/features/dev/WeightCardGallery'
import { FirstDosePage } from '@/features/record/first-dose/FirstDosePage'
import { NotFoundPage } from '@/features/common/NotFoundPage'
import { HomePage } from '@/features/home/HomePage'
import { IntakePage } from '@/features/intake/IntakePage'
import { MedicationDetailPage } from '@/features/record/medication/MedicationDetailPage'
import { MedicationListPage } from '@/features/record/medication/MedicationListPage'
import { MedicationNewPage } from '@/features/record/medication/MedicationNewPage'
import { RecordHubPage } from '@/features/record/RecordHubPage'
import { EyebodyComparePage, EyebodyPage } from '@/features/record/eyebody/EyebodyPages'
import { BodyLogEditPage, BodyLogListPage } from '@/features/record/body/BodyLogPages'
import { SymptomEditPage, SymptomPage } from '@/features/record/symptom/SymptomPages'

const soon = (path: string, title: string) => ({ path, element: <ComingSoonPage title={title} /> })

const routes: RouteObject[] = [
  {
    element: (
      <LiveGate need="ready">
        <AppLayout />
      </LiveGate>
    ),
    children: [
      { index: true, element: <Navigate to="/home" replace /> },
      { path: 'home', element: <HomePage /> },
      { path: 'onboarding/first-dose', element: <FirstDosePage /> },
      { path: 'preview/weight-cards', element: <WeightCardGallery /> },
      { path: 'preview/brand', element: <BrandPreview /> },

      { path: 'record', element: <RecordHubPage /> },
      { path: 'record/medication', element: <MedicationListPage /> },
      { path: 'record/medication/new', element: <MedicationNewPage /> },
      { path: 'record/medication/:id', element: <MedicationDetailPage /> },
      { path: 'record/meal', element: <MealListPage /> },
      { path: 'record/meal/new', element: <MealStartPage /> },
      { path: 'record/meal/photo', element: <MealPhotoPage /> },
      { path: 'record/meal/search', element: <FoodSearchPage /> },
      { path: 'record/meal/food/:foodId', element: <FoodDetailPage /> },
      { path: 'record/meal/custom', element: <CustomFoodPage /> },
      { path: 'record/meal/review', element: <MealReviewPage /> },
      { path: 'record/body', element: <BodyLogListPage /> },
      { path: 'record/body/new', element: <BodyLogEditPage /> },
      { path: 'record/body/:id', element: <BodyLogEditPage /> },
      soon('record/inbody', '인바디 OCR'),
      { path: 'record/eyebody', element: <EyebodyPage /> },
      { path: 'record/eyebody/compare', element: <EyebodyComparePage /> },
      { path: 'record/symptom', element: <SymptomPage /> },
      { path: 'record/symptom/:id', element: <SymptomEditPage /> },
      { path: 'record/daily', element: <IntakePage /> },

      {
        path: 'analysis',
        element: <AnalysisSection />,
        children: [
          { index: true, element: <AnalysisHubPage /> },
          { path: 'medication', element: <MedicationAnalysisPage /> },
          { path: 'timeline', element: <TimelinePage /> },
          { path: 'body', element: <BodyChangePage /> },
          { path: 'nutrition', element: <NutritionPage /> },
          { path: 'consult', element: <ConsultPage /> },
        ],
      },

      { path: 'community', element: <CommunityListPage /> },
      { path: 'community/write', element: <PostWritePage /> },
      { path: 'community/:id', element: <PostDetailPage /> },
      { path: 'community/:id/edit', element: <PostWritePage /> },
      { path: 'admin/moderation', element: <ModerationPage /> },
      { path: 'my', element: <MyPage /> },
      { path: 'my/profile', element: <ProfilePage /> },
      { path: 'my/consent', element: <ConsentPage /> },
      { path: 'my/body', element: <BodyGoalPage /> },
      { path: 'my/liked', element: <LikedPostsPage /> },
      { path: 'my/settings', element: <SettingsHubPage /> },
      { path: 'my/settings/notifications', element: <NotificationSettingsPage /> },
      { path: 'my/settings/app', element: <AppSettingsPage /> },
      { path: 'my/data', element: <DataManagePage /> },
      { path: 'my/support', element: <SupportPage /> },
      { path: 'my/terms', element: <TermsPage /> },
      { path: 'my/eyebody-data', element: <EyebodyDataPage /> },
      { path: 'my/account', element: <AccountPage /> },
    ],
  },
  { path: 'login', element: <LoginPage /> },
  { path: 'signup', element: <SignupPage /> },
  { path: 'auth/callback', element: <AuthCallbackPage /> },
  {
    path: 'consent',
    element: (
      <LiveGate need="session">
        <ConsentSignupPage />
      </LiveGate>
    ),
  },
  {
    path: 'onboarding',
    element: (
      <LiveGate need="consented">
        <OnboardingRoute />
      </LiveGate>
    ),
  },
  {
    path: 'onboarding/:step',
    element: (
      <LiveGate need="consented">
        <OnboardingRoute />
      </LiveGate>
    ),
  },
  { path: '*', element: <NotFoundPage /> },
]

/** 미리보기 링크 뒤 #이름 으로 시작 화면 지정 (예: #first-dose) */
const PREVIEW_START: Record<string, string> = {
  'first-dose': '/onboarding/first-dose',
  'weight-cards': '/preview/weight-cards',
  analysis: '/analysis',
  brand: '/preview/brand',
  meal: '/record/meal/new',
  login: '/login',
  onboarding: '/onboarding',
  community: '/community',
  my: '/my',
}

/** 미리보기 배포(VITE_PREVIEW=1)는 주소창을 쓸 수 없는 환경이라 메모리 라우터 사용 */
export const router =
  import.meta.env.VITE_PREVIEW === '1'
    ? createMemoryRouter(routes, { initialEntries: [PREVIEW_START[window.location.hash.slice(1)] ?? '/home'] })
    : createBrowserRouter(routes)
