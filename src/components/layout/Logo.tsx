import { Link } from 'react-router'

import { Logo as BrandLogo } from '@/components/brand/Logo'

/** 헤더·사이드바용 로고 링크 — 좁은 곳은 S 심볼만 */
export function Logo({ compactBelowLg = false, size = 30 }: { compactBelowLg?: boolean; size?: number }) {
  return (
    <Link to="/home" className="inline-flex items-center rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-primary/40" aria-label="SlimLog 홈">
      {compactBelowLg ? (
        <>
          <BrandLogo variant="symbol" size={size} className="lg:hidden" />
          <BrandLogo variant="horizontal" size={size} className="hidden lg:inline-flex" />
        </>
      ) : (
        <BrandLogo variant="horizontal" size={size} />
      )}
    </Link>
  )
}
