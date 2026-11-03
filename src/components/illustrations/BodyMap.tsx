import { useState } from 'react'

import { cn } from '@/lib/utils'
import type { BodyArea, InjectionSite } from '@/types/domain'

/**
 * 주사 부위 선택용 인체 일러스트 (정면/후면).
 * - 정면: 나를 마주 본 그림 → 화면 왼쪽 = 내 오른쪽
 * - 후면: 내 뒷모습 → 화면 왼쪽 = 내 왼쪽
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
}: {
  value: InjectionSite | null
  onChange: (site: InjectionSite) => void
  /** null이면 허가 부위 정보 없음 → 모든 부위 선택 가능 */
  allowedAreas: BodyArea[] | null
  siteLabel: (s: InjectionSite) => string
}) {
  const [view, setView] = useState<View>(value?.startsWith('arm') ? 'front' : 'front')
  const isAllowed = (area: BodyArea) => !allowedAreas || allowedAreas.includes(area)
  const hasArm = isAllowed('upper_arm')
  const list = zones(view)

  return (
    <div>
      {hasArm && (
        <div role="radiogroup" aria-label="그림 방향" className="mx-auto mb-3 flex w-fit rounded-xl bg-surface-muted p-1">
          {(['front', 'back'] as View[]).map((v) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={view === v}
              onClick={() => setView(v)}
              className={cn(
                'h-9 min-w-16 rounded-lg px-3 text-[13px] font-medium',
                view === v ? 'bg-surface font-semibold text-text shadow-[0_1px_2px_rgba(15,23,42,0.08)]' : 'text-text-muted',
              )}
            >
              {v === 'front' ? '앞모습' : '뒷모습'}
            </button>
          ))}
        </div>
      )}

      <div className="mx-auto flex max-w-[300px] items-start justify-between text-[12px] font-semibold text-text-muted">
        <span>{view === 'front' ? '내 오른쪽' : '내 왼쪽'}</span>
        <span className="text-[11px] font-medium text-text-subtle">{view === 'front' ? '나를 마주 본 모습' : '내 뒷모습'}</span>
        <span>{view === 'front' ? '내 왼쪽' : '내 오른쪽'}</span>
      </div>

      <svg viewBox="0 0 200 400" className="mx-auto mt-1 block h-[320px] w-auto max-w-full" role="group" aria-label="주사 부위 선택 그림">
        <Silhouette />
        {view === 'front' && <circle cx="100" cy="170" r="2.5" className="fill-border" />}
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
                'outline-none [&>*]:transition-colors',
                allowed ? 'cursor-pointer' : 'cursor-not-allowed',
                selected
                  ? '[&>*]:fill-primary [&>*]:stroke-primary'
                  : allowed
                    ? '[&>*]:fill-primary-soft [&>*]:stroke-primary/50 hover:[&>*]:fill-primary/25 focus-visible:[&>*]:stroke-primary'
                    : '[&>*]:fill-transparent [&>*]:stroke-transparent',
              )}
              strokeWidth={selected ? 2 : 1.5}
              strokeDasharray={selected ? undefined : '4 3'}
            >
              {z.shape}
            </g>
          )
        })}
      </svg>
    </div>
  )
}
