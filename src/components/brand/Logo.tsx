import { cn } from '@/lib/utils'

/**
 * SlimLog 공식 로고 (시안 — 확정 전).
 * S 심볼: 한 획 곡선 + 왼쪽 아래 밝은 에메랄드 점. 좌표는 public/brand/*.svg와 동일.
 */
// eslint-disable-next-line react-refresh/only-export-components
export const BRAND = { main: '#0B7A5A', dot: '#22C08A', slogan: '#5B7A70', iconBg: '#E9F7F1' } as const
const S_PATH = 'M80 16H34.5A18.5 18.5 0 0 0 34.5 53H63.5A18.5 18.5 0 0 1 63.5 90H22'

type Tone = 'brand' | 'mono' | 'white'
const toneColors = (tone: Tone) =>
  tone === 'brand'
    ? { main: BRAND.main, dot: BRAND.dot, text: BRAND.main, slogan: BRAND.slogan }
    : tone === 'white'
      ? { main: '#FFFFFF', dot: '#FFFFFF', text: '#FFFFFF', slogan: 'rgba(255,255,255,0.75)' }
      : { main: 'currentColor', dot: 'currentColor', text: 'currentColor', slogan: 'currentColor' }

export function LogoSymbol({ size = 32, tone = 'brand', className, title }: { size?: number; tone?: Tone; className?: string; title?: string }) {
  const c = toneColors(tone)
  return (
    <svg
      viewBox="0 4 98 98"
      width={size}
      height={size}
      className={cn('shrink-0', className)}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <path d={S_PATH} fill="none" stroke={c.main} strokeWidth={16} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="22" cy="90" r="8.5" fill={c.dot} />
    </svg>
  )
}

export function Logo({
  variant = 'horizontal',
  size = 32,
  tone = 'brand',
  className,
}: {
  variant?: 'symbol' | 'horizontal' | 'vertical'
  /** 심볼 높이(px) */
  size?: number
  tone?: Tone
  className?: string
}) {
  const c = toneColors(tone)
  if (variant === 'symbol') return <LogoSymbol size={size} tone={tone} className={className} title="SlimLog" />
  if (variant === 'vertical')
    return (
      <span className={cn('inline-flex flex-col items-center', className)} role="img" aria-label="SlimLog 나의 변화를 기록하다">
        <LogoSymbol size={size} tone={tone} />
        <span className="font-bold tracking-[-0.01em]" style={{ color: c.text, fontSize: size * 0.41, marginTop: size * 0.3, lineHeight: 1 }}>
          SlimLog
        </span>
        <span className="font-medium tracking-[0.02em]" style={{ color: c.slogan, fontSize: Math.max(11, size * 0.14), marginTop: size * 0.14 }}>
          나의 변화를 기록하다
        </span>
      </span>
    )
  return (
    <span className={cn('inline-flex items-center', className)} role="img" aria-label="SlimLog" style={{ gap: size * 0.25 }}>
      <LogoSymbol size={size} tone={tone} />
      <span className="font-bold tracking-[-0.01em]" style={{ color: c.text, fontSize: size * 0.6, lineHeight: 1 }}>
        SlimLog
      </span>
    </span>
  )
}

/** 앱 아이콘 형태 (둥근 사각 + 심볼만) — 작은 크기 전용 */
export function LogoAppIcon({ size = 48, className }: { size?: number; className?: string }) {
  return (
    <span
      className={cn('inline-flex shrink-0 items-center justify-center', className)}
      style={{ width: size, height: size, borderRadius: size * 0.22, background: BRAND.iconBg }}
      role="img"
      aria-label="SlimLog"
    >
      <LogoSymbol size={size * 0.58} />
    </span>
  )
}
