import { createBrowserRouter, createMemoryRouter, Navigate, type RouteObject } from 'react-router'

import { AppLayout } from '@/components/layout/AppLayout'
import { AnalysisHubPage } from '@/features/analysis/AnalysisHubPage'
import { AnalysisSection } from '@/features/analysis/AnalysisSection'
import { MedicationAnalysisPage } from '@/features/analysis/MedicationAnalysisPage'
import { ComingSoonPage } from '@/features/common/ComingSoonPage'
import { BrandPreview } from '@/features/dev/BrandPreview'
import { WeightCardGallery } from '@/features/dev/WeightCardGallery'
import { FirstDosePage } from '@/features/record/first-dose/FirstDosePage'
import { NotFoundPage } from '@/features/common/NotFoundPage'
import { HomePage } from '@/features/home/HomePage'
import { MedicationDetailPage } from '@/features/record/medication/MedicationDetailPage'
import { MedicationListPage } from '@/features/record/medication/MedicationListPage'
import { MedicationNewPage } from '@/features/record/medication/MedicationNewPage'
import { RecordHubPage } from '@/features/record/RecordHubPage'

const soon = (path: string, title: string) => ({ path, element: <ComingSoonPage title={title} /> })

const routes: RouteObject[] = [
  {
    element: <AppLayout />,
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
      soon('record/meal', 'AI 식단'),
      soon('record/meal/new', '식단 기록하기'),
      soon('record/body', '체중 · 체성분'),
      soon('record/inbody', '인바디 OCR'),
      soon('record/eyebody', '눈바디'),
      soon('record/eyebody/compare', '눈바디 비교'),
      soon('record/symptom', '증상 · 컨디션'),
      soon('record/daily', '물 · 단백질 · 영양제'),

      {
        path: 'analysis',
        element: <AnalysisSection />,
        children: [
          { index: true, element: <AnalysisHubPage /> },
          { path: 'medication', element: <MedicationAnalysisPage /> },
          soon('timeline', '통합 타임라인'),
          soon('body', '바디 변화'),
          soon('nutrition', '식단 · 영양'),
          soon('consult', '상담 준비'),
        ],
      },

      soon('community', '커뮤니티'),
      soon('community/write', '글쓰기'),
      soon('community/:id', '게시글'),
      soon('admin/moderation', '관리자 검토'),
      soon('my', '마이'),
    ],
  },
  soon('login', '로그인'),
  soon('signup', '회원가입'),
  soon('consent', '개인정보 동의'),
  soon('onboarding', '시작하기'),
  { path: '*', element: <NotFoundPage /> },
]

/** 미리보기 링크 뒤 #이름 으로 시작 화면 지정 (예: #first-dose) */
const PREVIEW_START: Record<string, string> = {
  'first-dose': '/onboarding/first-dose',
  'weight-cards': '/preview/weight-cards',
  analysis: '/analysis',
  brand: '/preview/brand',
}

/** 미리보기 배포(VITE_PREVIEW=1)는 주소창을 쓸 수 없는 환경이라 메모리 라우터 사용 */
export const router =
  import.meta.env.VITE_PREVIEW === '1'
    ? createMemoryRouter(routes, { initialEntries: [PREVIEW_START[window.location.hash.slice(1)] ?? '/home'] })
    : createBrowserRouter(routes)
