import { createBrowserRouter, Navigate } from 'react-router'

import { AppLayout } from '@/components/layout/AppLayout'
import { AnalysisHubPage } from '@/features/analysis/AnalysisHubPage'
import { MedicationAnalysisPage } from '@/features/analysis/MedicationAnalysisPage'
import { ComingSoonPage } from '@/features/common/ComingSoonPage'
import { NotFoundPage } from '@/features/common/NotFoundPage'
import { HomePage } from '@/features/home/HomePage'
import { MedicationDetailPage } from '@/features/record/medication/MedicationDetailPage'
import { MedicationListPage } from '@/features/record/medication/MedicationListPage'
import { MedicationNewPage } from '@/features/record/medication/MedicationNewPage'
import { RecordHubPage } from '@/features/record/RecordHubPage'

const soon = (path: string, title: string) => ({ path, element: <ComingSoonPage title={title} /> })

export const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      { index: true, element: <Navigate to="/home" replace /> },
      { path: 'home', element: <HomePage /> },

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

      { path: 'analysis', element: <AnalysisHubPage /> },
      { path: 'analysis/medication', element: <MedicationAnalysisPage /> },
      soon('analysis/timeline', '통합 타임라인'),
      soon('analysis/body', '바디 변화'),
      soon('analysis/nutrition', '식단 · 영양'),
      soon('analysis/consult', '상담 준비'),

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
])
