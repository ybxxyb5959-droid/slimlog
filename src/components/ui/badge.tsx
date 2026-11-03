import { cva, type VariantProps } from 'class-variance-authority'
import type * as React from 'react'

import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[12px] font-semibold',
  {
    variants: {
      tone: {
        neutral: 'bg-surface-muted text-text-muted',
        success: 'bg-primary-soft text-primary',
        review: 'bg-review-soft text-review',
        danger: 'bg-danger-soft text-danger',
        info: 'bg-icon-soft text-icon',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
)

export function Badge({
  className,
  tone,
  ...props
}: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />
}
