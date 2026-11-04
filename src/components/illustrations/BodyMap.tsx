import { cn } from '@/lib/utils'
import type { BodyArea, InjectionSite } from '@/types/domain'

/**
 * 주사 부위 선택용 인체 일러스트 (정면만 — 나를 마주 본 그림: 화면 왼쪽 = 내 오른쪽)
 * 기록용 UI이며 위치를 추천하지 않는다.
 */
type View = 'front' | 'back'

interface Zone {
  site: InjectionSite
  area: BodyArea
  /** 좌표는 viewBox 200x400 기준 */
  shape: React.ReactNode
  views: View[]
}

const ARM_L = 'rotate(9 44 88)' // 화면 왼쪽 팔
const ARM_R = 'rotate(-9 156 88)'

function zones(view: View): Zone[] {
  // 정면에서는 화면 왼쪽이 내 오른쪽, 후면에서는 화면 왼쪽이 내 왼쪽
  const screenLeft: 'left' | 'right' = view === 'front' ? 'right' : 'left'
  const screenRight: 'left' | 'right' = view === 'front' ? 'left' : 'right'
  return [
    { site: `abdomen_${screenLeft}` as InjectionSite, area: 'abdomen', views: ['front'], shape: <rect x="71" y="146" width="25" height="46" rx="11" /> },
    { site: `abdomen_${screenRight}` as InjectionSite, area: 'abdomen', views: ['front'], shape: <rect x="104" y="146" width="25" height="46" rx="11" /> },
    { site: `thigh_${screenLeft}` as InjectionSite, area: 'thigh', views: ['front'], shape: <rect x="71" y="248" width="25" height="62" rx="11" /> },
    { site: `thigh_${screenRight}` as InjectionSite, area: 'thigh', views: ['front'], shape: <rect x="104" y="248" width="25" height="62" rx="11" /> },
    { site: `arm_${screenLeft}` as InjectionSite, area: 'upper_arm', views: ['front', 'back'], shape: <rect x="36" y="100" width="16" height="50" rx="8" transform={ARM_L} /> },
    { site: `arm_${screenRight}` as InjectionSite, area: 'upper_arm', views: ['front', 'back'], shape: <rect x="148" y="100" width="16" height="50" rx="8" transform={ARM_R} /> },
  ].filter((z) => z.views.includes(view)) as Zone[]
}

function Silhouette() {
  return (
    <g className="fill-surface-muted stroke-border" strokeWidth={1.5}>
      <circle cx="100" cy="40" r="23" />
      <rect x="90" y="60" width="20" height="16" rx="6" />
      <rect x="34" y="82" width="20" height="150" rx="10" transform={ARM_L} />
      <rect x="146" y="82" width="20" height="150" rx="10" transform={ARM_R} />
      <rect x="67" y="222" width="31" height="166" rx="14" />
      <rect x="102" y="222" width="31" height="166" rx="14" />
      <path d="M70 74Q57 76 55 92L60 200Q62 224 66 234H134Q138 224 140 200L145 92Q143 76 130 74Z" />
    </g>
  )
}

export function BodyMap({
  value,
  onChange,
  allowedAreas,
  siteLabel,
  className,
}: {
  value: InjectionSite | null
  onChange: (site: InjectionSite) => void
  /** null이면 허가 부위 정보 없음 → 모든 부위 선택 가능 */
  allowedAreas: BodyArea[] | null
  siteLabel: (s: InjectionSite) => string
  className?: string
}) {
  const isAllowed = (area: BodyArea) => !allowedAreas || allowedAreas.includes(area)
  const list = zones('front')

  return (
    <div className={className}>
      <div className="flex items-start justify-between px-1 text-[12px] font-semibold text-text-muted">
        <span>내 오른쪽</span>
        <span>내 왼쪽</span>
      </div>
      <svg viewBox="0 0 200 400" className="mx-auto mt-1 block h-[300px] w-auto max-w-full" role="group" aria-label="주사 부위 선택 그림 (나를 마주 본 모습)">
        <Silhouette />
        <circle cx="100" cy="170" r="2.5" className="fill-border" />
        {list.map((z) => {
          const allowed = isAllowed(z.area)
          const selected = value === z.site
          const label = siteLabel(z.site)
          return (
            <g
              key={z.site}
              role="radio"
              aria-checked={selected}
              aria-disabled={!allowed}
              aria-label={allowed ? label : `${label} (이 약의 허가 부위가 아님)`}
              tabIndex={allowed ? 0 : -1}
              onClick={() => allowed && onChange(z.site)}
              onKeyDown={(e) => {
                if (allowed && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault()
                  onChange(z.site)
                }
              }}
              className={cn(
                'outline-none [&>rect]:transition-colors',
                allowed ? 'cursor-pointer' : 'cursor-not-allowed',
                selected
                  ? '[&>rect]:fill-primary [&>rect]:stroke-primary'
                  : allowed
                    ? '[&>rect]:fill-primary-soft [&>rect]:stroke-primary/60 hover:[&>rect]:fill-primary/25 focus-visible:[&>rect]:stroke-primary'
                    : '[&>rect]:fill-transparent [&>rect]:stroke-transparent',
              )}
              strokeWidth={selected ? 2 : 1.5}
            >
              {z.shape}
              {selected && <SelectedCheck site={z.site} />}
            </g>
          )
        })}
      </svg>
    </div>
  )
}

/** 고른 부위 가운데 체크 표시 */
const CHECK_AT: Partial<Record<string, [number, number]>> = {
  abdomen_right: [83.5, 169],
  abdomen_left: [116.5, 169],
  thigh_right: [83.5, 279],
  thigh_left: [116.5, 279],
  arm_right: [38.2, 124.5],
  arm_left: [161.8, 124.5],
}
function SelectedCheck({ site }: { site: InjectionSite }) {
  const at = CHECK_AT[site]
  if (!at) return null
  const [x, y] = at
  return <path d={`M${x - 5} ${y}l3.5 3.5 6.5 -7`} fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" pointerEvents="none" />
}
