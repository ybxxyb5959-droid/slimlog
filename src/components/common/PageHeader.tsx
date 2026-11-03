import { ChevronLeft } from 'lucide-react'
import type * as React from 'react'
import { useNavigate } from 'react-router'

import { cn } from '@/lib/utils'

import { AppIcon } from './AppIcon'

export function PageHeader({
  title,
  description,
  back,
  actions,
  className,
}: {
  title: React.ReactNode
  description?: React.ReactNode
  /** true면 뒤로가기, 문자열이면 해당 경로로 */
  back?: boolean | string
  actions?: React.ReactNode
  className?: string
}) {
  const navigate = useNavigate()
  return (
    <header className={cn('mb-5 flex items-start gap-2', className)}>
      {back && (
        <button
          type="button"
          onClick={() => (typeof back === 'string' ? navigate(back) : navigate(-1))}
          className="-ml-2 inline-flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-surface-muted"
          aria-label="뒤로 가기"
        >
          <AppIcon icon={ChevronLeft} size="lg" tone="text" />
        </button>
      )}
      <div className={cn('min-w-0 flex-1', back && 'pt-2')}>
        <h1 className="text-[22px] leading-tight font-bold tracking-tight text-text md:text-2xl">{title}</h1>
        {description && <p className="mt-1 text-[14px] text-text-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
    </header>
  )
}
