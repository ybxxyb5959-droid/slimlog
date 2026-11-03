import type * as React from 'react'

import { cn } from '@/lib/utils'

export function Input({ className, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      className={cn(
        'h-12 w-full min-w-0 rounded-xl border border-border bg-surface px-4 text-[15px] text-text outline-none transition-colors placeholder:text-text-subtle focus:border-primary focus:ring-2 focus:ring-primary/15 aria-invalid:border-danger',
        className,
      )}
      {...props}
    />
  )
}
