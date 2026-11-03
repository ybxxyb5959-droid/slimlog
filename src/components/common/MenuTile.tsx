import { ChevronRight, type LucideIcon } from 'lucide-react'
import { Link } from 'react-router'

import { cn } from '@/lib/utils'

import { AppIcon } from './AppIcon'

/** 아이콘 박스 + 제목 + 설명 — 참고 이미지 구조 */
export function MenuTile({
  to,
  icon,
  title,
  description,
  meta,
  className,
}: {
  to: string
  icon: LucideIcon
  title: string
  description?: string
  meta?: React.ReactNode
  className?: string
}) {
  return (
    <Link
      to={to}
      className={cn(
        'flex min-h-[72px] items-center gap-3.5 rounded-card border border-border bg-surface px-4 py-3.5 transition-colors hover:bg-surface-muted/60 active:bg-surface-muted',
        className,
      )}
    >
      <AppIcon icon={icon} size="lg" bg="soft" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-semibold text-text">{title}</p>
        {description && <p className="truncate text-[13px] text-text-muted">{description}</p>}
      </div>
      {meta}
      <AppIcon icon={ChevronRight} size="sm" tone="muted" />
    </Link>
  )
}
