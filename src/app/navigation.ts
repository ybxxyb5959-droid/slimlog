import {
  Activity,
  CalendarRange,
  Camera,
  ChartLine,
  ClipboardList,
  GlassWater,
  House,
  type LucideIcon,
  MessagesSquare,
  PersonStanding,
  Scale,
  ScanText,
  SquarePen,
  Syringe,
  TrendingDown,
  UserRound,
  Utensils,
} from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
}

/** 5탭 — 모바일 하단 탭과 데스크톱 사이드바가 같은 목록을 쓴다 */
export const MAIN_TABS: NavItem[] = [
  { to: '/home', label: '홈', icon: House },
  { to: '/record', label: '기록', icon: SquarePen },
  { to: '/analysis', label: '분석', icon: ChartLine },
  { to: '/community', label: '커뮤니티', icon: MessagesSquare },
  { to: '/my', label: '마이', icon: UserRound },
]

export interface MenuItem extends NavItem {
  description: string
}

export const RECORD_MENUS: MenuItem[] = [
  { to: '/record/medication', label: '투약 기록', icon: Syringe, description: '약 · 용량 · 부위' },
  { to: '/record/meal', label: 'AI 식단', icon: Utensils, description: '사진으로 음식 기록' },
  { to: '/record/body', label: '체중 · 체성분', icon: Scale, description: '수동 입력' },
  { to: '/record/inbody', label: '인바디 OCR', icon: ScanText, description: '결과지 촬영 → 확인' },
  { to: '/record/eyebody', label: '눈바디', icon: Camera, description: '이 기기에만 저장' },
  { to: '/record/symptom', label: '증상 · 컨디션', icon: Activity, description: '강도 · 컨디션' },
  { to: '/record/daily', label: '케어', icon: GlassWater, description: '물 · 영양제 · 복용약' },
]

export const ANALYSIS_MENUS: MenuItem[] = [
  { to: '/analysis/timeline', label: '통합 타임라인', icon: CalendarRange, description: '투약 · 식단 · 증상 같은 날짜축' },
  { to: '/analysis/body', label: '바디 변화', icon: PersonStanding, description: '체성분 + 눈바디' },
  { to: '/analysis/medication', label: '참고용 잔존량', icon: TrendingDown, description: '실제 혈중농도 아님' },
  { to: '/analysis/nutrition', label: '식단 · 영양', icon: Utensils, description: '단백질 목표 대비' },
  { to: '/analysis/consult', label: '상담 준비', icon: ClipboardList, description: '진료 때 보여줄 요약' },
]
