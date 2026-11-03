import { ChevronRight, type LucideIcon } from 'lucide-react'
import type * as React from 'react'
import { Link } from 'react-router'

import { AppIcon } from '@/components/common/AppIcon'
import { cn } from '@/lib/utils'

/** 마이 메뉴 한 줄 */
export function MyRow({ to, icon, label, meta, danger }: { to: string; icon: LucideIcon; label: string; meta?: React.ReactNode; danger?: boolean }) {
  return (
    <Link to={to} className="flex min-h-14 items-center gap-3 px-5 py-3 hover:bg-surface-muted/60">
      <AppIcon icon={icon} size="sm" tone={danger ? 'danger' : 'primary'} />
      <span className={cn('flex-1 text-[15px]', danger && 'text-danger')}>{label}</span>
      {meta && <span className="text-[13px] text-text-muted">{meta}</span>}
      <AppIcon icon={ChevronRight} size="sm" tone="muted" />
    </Link>
  )
}

export function MyGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 px-1 text-[13px] font-semibold text-text-muted">{title}</h2>
      <div className="divide-y divide-border overflow-hidden rounded-card border border-border bg-surface">{children}</div>
    </section>
  )
}

/** 스위치가 있는 설정 한 줄 */
export function SettingRow({ id, label, description, children }: { id: string; label: string; description?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex min-h-16 items-center gap-4 px-5 py-3.5">
      <label htmlFor={id} className="min-w-0 flex-1 cursor-pointer">
        <span className="block text-[15px] text-text">{label}</span>
        {description && <span className="mt-0.5 block text-[12px] leading-relaxed text-text-muted">{description}</span>}
      </label>
      {children}
    </div>
  )
}
