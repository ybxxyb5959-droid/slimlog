import type { LucideIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

/**
 * 모든 아이콘은 이 컴포넌트로만 그린다.
 * - 선 굵기 1.75 고정 (prop으로 변경 불가)
 * - 크기 sm 20 / md 22 / lg 24
 * - 색은 토큰(--icon 등)으로만 지정 — 이모지 사용 금지
 */
const SIZE = { sm: 20, md: 22, lg: 24 } as const
const BOX = { sm: 'size-9 rounded-[10px]', md: 'size-10 rounded-xl', lg: 'size-11 rounded-xl' } as const

const TONE = {
  primary: 'text-icon',
  muted: 'text-icon-inactive',
  text: 'text-text',
  success: 'text-primary',
  review: 'text-review',
  danger: 'text-danger',
  inverse: 'text-white',
} as const

const BG = {
  none: '',
  soft: 'bg-icon-soft',
  neutral: 'bg-surface-muted',
  success: 'bg-primary-soft',
  review: 'bg-review-soft',
  danger: 'bg-danger-soft',
} as const

export const ICON_STROKE = 1.75

export interface AppIconProps {
  icon: LucideIcon
  size?: keyof typeof SIZE
  tone?: keyof typeof TONE
  bg?: keyof typeof BG
  className?: string
  /** 의미 있는 아이콘이면 라벨 지정, 장식이면 생략(aria-hidden) */
  label?: string
}

export function AppIcon({ icon: Icon, size = 'md', tone = 'primary', bg = 'none', className, label }: AppIconProps) {
  const svg = (
    <Icon
      size={SIZE[size]}
      strokeWidth={ICON_STROKE}
      absoluteStrokeWidth
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? 'img' : undefined}
      className={cn('shrink-0', TONE[tone], bg === 'none' && className)}
    />
  )
  if (bg === 'none') return svg
  return (
    <span className={cn('inline-flex shrink-0 items-center justify-center', BOX[size], BG[bg], className)}>{svg}</span>
  )
}
