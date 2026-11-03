import type * as React from 'react'

import { cn } from '@/lib/utils'

export function SectionTitle({
  children,
  action,
  className,
}: {
  children: React.ReactNode
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('mt-7 mb-3 flex items-center justify-between gap-3', className)}>
      <h2 className="text-[17px] font-bold text-text">{children}</h2>
      {action}
    </div>
  )
}
