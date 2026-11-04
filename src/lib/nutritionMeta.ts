import { Drumstick, Droplet, Wheat, type LucideIcon } from 'lucide-react'

/** 영양소별 아이콘·색 — 식단 분석 화면과 같은 색 토큰 */
export const MACRO_META: { key: 'carbG' | 'proteinG' | 'fatG'; label: string; icon: LucideIcon; color: string }[] = [
  { key: 'carbG', label: '탄수화물', icon: Wheat, color: 'var(--nutri-carb)' },
  { key: 'proteinG', label: '단백질', icon: Drumstick, color: 'var(--nutri-protein)' },
  { key: 'fatG', label: '지방', icon: Droplet, color: 'var(--nutri-fat)' },
]

