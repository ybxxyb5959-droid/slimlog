import { cn } from '@/lib/utils'

/** 가상 데이터임을 알리는 배지 — fixtures 데이터를 보여주는 카드에 반드시 붙인다 */
export function MockBadge({ className, label = '예시 데이터' }: { className?: string; label?: string }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-md border border-dashed border-text-subtle/60 px-1.5 py-px text-[11px] font-medium text-text-subtle',
        className,
      )}
    >
      {label}
    </span>
  )
}
