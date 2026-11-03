import { Label as LabelPrimitive } from 'radix-ui'
import type * as React from 'react'

import { cn } from '@/lib/utils'

export function Label({ className, ...props }: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root className={cn('mb-2 block text-[13px] font-medium text-text-muted', className)} {...props} />
  )
}
