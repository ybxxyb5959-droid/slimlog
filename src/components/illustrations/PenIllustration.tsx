import { cn } from '@/lib/utils'

/**
 * 범용 주사 펜 일러스트 (실제 제품 이미지·디자인을 쓰지 않는다).
 * band 색만 용량 단계별로 달라진다 — 한 가지 색상의 밝기 단계(순차 색).
 */
export function PenIllustration({ band, className }: { band: string; className?: string }) {
  return (
    <svg viewBox="0 0 40 120" className={cn('fill-none stroke-text-muted', className)} strokeWidth={1.75} strokeLinejoin="round" aria-hidden>
      <rect x="12" y="4" width="16" height="22" rx="5" className="fill-surface-muted" />
      <rect x="9" y="24" width="22" height="80" rx="8" className="fill-surface" />
      <rect x="9" y="30" width="22" height="16" style={{ fill: band, stroke: 'none' }} />
      <rect x="15" y="58" width="10" height="22" rx="3" className="fill-surface-muted" />
      <path d="M15 98h10" />
      <rect x="15" y="104" width="10" height="10" rx="3" className="fill-surface-muted" />
    </svg>
  )
}

/** 용량 단계별 색 (파랑 순차 램프, 밝음 → 진함) */
const RAMP = ['#c9dbfa', '#a3c1f5', '#7ba4ee', '#5487e6', '#2f6fe4', '#2257bd']
// eslint-disable-next-line react-refresh/only-export-components
export function doseBandColor(index: number, total: number) {
  if (total <= 1) return RAMP[4]
  const i = Math.round((index / (total - 1)) * (RAMP.length - 1))
  return RAMP[i]
}
