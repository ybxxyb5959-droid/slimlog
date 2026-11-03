import type { AnalogyIllustrationId } from '@/fixtures/weightAnalogies'
import { cn } from '@/lib/utils'

/**
 * 감량 비유용 선형 일러스트 — 모두 같은 규칙으로 그린다.
 * viewBox 48, 선 1.75, 둥근 끝, 선=--icon, 면=--icon-soft
 */
const SHAPES: Record<AnalogyIllustrationId | 'scale', React.ReactNode> = {
  apple: (
    <>
      <path className="fill" d="M24 15c-4-3-12-2-13.5 6.5C9.2 29.6 14.5 39 19.8 39c1.9 0 3-1 4.2-1s2.3 1 4.2 1c5.3 0 10.6-9.4 9.3-17.5C36 13 28 12 24 15z" />
      <path d="M24 15c0-3 1-5.5 3.5-7" />
      <path className="fill" d="M25.5 11c3-2.6 6.6-2 8 0-3 2.4-6.2 2.2-8 0z" />
      <path d="M17 22c-1.2 1.6-1.6 3.6-1.4 5.6" />
    </>
  ),
  milk: (
    <>
      <path className="fill" d="M14 19h20v20.5a2.5 2.5 0 0 1-2.5 2.5h-15a2.5 2.5 0 0 1-2.5-2.5z" />
      <path className="fill" d="M14 19l4.5-8h11l4.5 8z" />
      <path d="M18.5 11V6.5h11V11" />
      <path d="M24 11l-2 8" />
      <rect x="18.5" y="26" width="11" height="9" rx="1.5" />
    </>
  ),
  padding: (
    <>
      <path className="fill" d="M18.5 8.5 10 13l-3.5 15 6 2 1.5-8.5V41h20V21.5l1.5 8.5 6-2L38 13l-8.5-4.5-2.5 3h-6z" />
      <path d="M14 21.5h20M14 28h20M14 34.5h20" />
      <path d="M24 11.5V41" />
      <path d="M21 11.5l3 3.5 3-3.5" />
    </>
  ),
  cat: (
    <>
      <path className="fill" d="M15.5 41c-2.5-6-2-13.5 3-18L17.5 11l5.5 5h4l5.5-5-1 12c5 4.5 5.5 12 3 18z" />
      <path d="M33.5 41c5 .5 9-2.5 7-7.5" />
      <path d="M21 25.5h.01M27 25.5h.01" strokeWidth={3} />
      <path d="M23 29.5h2l-1 1.2z" />
    </>
  ),
  watermelon: (
    <>
      <path className="fill" d="M7 27c0-9.4 7.6-15.5 17-15.5S41 17.6 41 27s-7.6 13.5-17 13.5S7 36.4 7 27z" />
      <path d="M15.5 13.5c-3 8-3 18.5 0 25.5M24 11.5c-1.2 9.4-1.2 19.6 0 29M32.5 13.5c3 8 3 18.5 0 25.5" />
      <path d="M24 11.5c0-2.4 1.2-4.4 3.5-5" />
    </>
  ),
  rice: (
    <>
      <path className="fill" d="M13.5 13h21l2.5 6.5-2.5 22h-21L11 19.5z" />
      <path d="M13.5 13c3.5 2.2 17.5 2.2 21 0" />
      <path d="M18 13l-2-5.5M30 13l2-5.5M24 13V7" />
      <rect x="17.5" y="24" width="13" height="9" rx="1.5" />
    </>
  ),
  scale: (
    <>
      <rect className="fill" x="8" y="14" width="32" height="26" rx="6" />
      <path d="M16.5 24a7.5 7.5 0 0 1 15 0" />
      <path d="M24 24l3-4" />
      <path d="M14 34h20" />
    </>
  ),
}

export function AnalogyIllustration({
  id,
  className,
  title,
}: {
  id: AnalogyIllustrationId | 'scale'
  className?: string
  title?: string
}) {
  return (
    <svg
      viewBox="0 0 48 48"
      className={cn(
        'shrink-0 fill-none stroke-icon [&_.fill]:fill-icon-soft',
        className,
      )}
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {SHAPES[id]}
    </svg>
  )
}
