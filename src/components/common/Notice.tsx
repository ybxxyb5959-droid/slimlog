import { CircleAlert, Info, ShieldBan } from 'lucide-react'
import type * as React from 'react'

import { cn } from '@/lib/utils'

import { AppIcon } from './AppIcon'

const STYLE = {
  info: { box: 'bg-surface-muted text-text-muted', icon: Info, tone: 'muted' },
  review: { box: 'bg-review-soft text-review border border-review-border', icon: CircleAlert, tone: 'review' },
  danger: { box: 'bg-danger-soft text-danger border border-danger-border', icon: ShieldBan, tone: 'danger' },
} as const

/** 안내·면책 문구 박스. 의미 색 규칙: review=참고·검토, danger=차단 */
export function Notice({
  tone = 'info',
  title,
  children,
  className,
}: {
  tone?: keyof typeof STYLE
  title?: React.ReactNode
  children?: React.ReactNode
  className?: string
}) {
  const s = STYLE[tone]
  return (
    <div className={cn('flex gap-2.5 rounded-xl px-4 py-3 text-[13px] leading-relaxed', s.box, className)}>
      <AppIcon icon={s.icon} size="sm" tone={s.tone} className="mt-px size-[18px]" />
      <div className="min-w-0">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cn(title && 'mt-0.5 opacity-90')}>{children}</div>}
      </div>
    </div>
  )
}

/** 참고 곡선 고정 문구 — 문구를 바꾸지 말 것 */
export const RESIDUAL_DISCLAIMER = '참고용 계산값이며 실제 혈중농도 또는 약효를 의미하지 않습니다.'
export const TIMELINE_DISCLAIMER = '기록을 한눈에 보기 위한 화면이며, 증상의 원인을 판단하지 않습니다.'
