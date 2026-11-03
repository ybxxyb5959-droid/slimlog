import { CircleAlert, Inbox, LoaderCircle, type LucideIcon } from 'lucide-react'
import type * as React from 'react'

import { cn } from '@/lib/utils'

import { AppIcon } from './AppIcon'

function StateBase({
  icon,
  tone,
  title,
  description,
  action,
  className,
  spin,
}: {
  icon: LucideIcon
  tone: 'muted' | 'danger' | 'primary'
  title: string
  description?: React.ReactNode
  action?: React.ReactNode
  className?: string
  spin?: boolean
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-10 text-center', className)}>
      <AppIcon
        icon={icon}
        size="lg"
        tone={tone}
        bg={tone === 'danger' ? 'danger' : 'neutral'}
        className={cn('size-14 rounded-2xl', spin && '[&>svg]:animate-spin')}
      />
      <p className="mt-4 text-[15px] font-semibold text-text">{title}</p>
      {description && <p className="mt-1 max-w-xs text-[13px] text-text-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function EmptyState(props: { title: string; description?: React.ReactNode; action?: React.ReactNode; icon?: LucideIcon; className?: string }) {
  return <StateBase icon={props.icon ?? Inbox} tone="muted" {...props} />
}

export function ErrorState(props: { title?: string; description?: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return <StateBase icon={CircleAlert} tone="danger" title={props.title ?? '문제가 생겼어요'} {...props} />
}

export function LoadingState(props: { title?: string; description?: React.ReactNode; className?: string }) {
  return <StateBase icon={LoaderCircle} tone="primary" spin title={props.title ?? '불러오는 중이에요'} {...props} />
}
