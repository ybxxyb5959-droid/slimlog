import { useRef } from 'react'

import { hourLabel } from '@/lib/date'
import { cn } from '@/lib/utils'

/**
 * 원판 시계에서 시침을 끌어 '시'를 고른다 (분 없음). 오전/오후는 위 버튼으로.
 * 키보드: ← → 로 한 시간씩 (role=slider)
 */
const SIZE = 248
const R = SIZE / 2
const NUM_R = R - 30


export function HourClock({ hour, onChange }: { hour: number; onChange: (h: number) => void }) {
  const svg = useRef<SVGSVGElement>(null)
  const pm = hour >= 12
  const h12 = hour % 12 // 0 = 12시 위치
  const angle = (h12 / 12) * 2 * Math.PI - Math.PI / 2
  const handX = R + Math.cos(angle) * (NUM_R - 6)
  const handY = R + Math.sin(angle) * (NUM_R - 6)

  const pick = (clientX: number, clientY: number) => {
    const box = svg.current!.getBoundingClientRect()
    const x = clientX - box.left - box.width / 2
    const y = clientY - box.top - box.height / 2
    let a = Math.atan2(y, x) + Math.PI / 2
    if (a < 0) a += 2 * Math.PI
    const n = Math.round((a / (2 * Math.PI)) * 12) % 12
    onChange(n + (pm ? 12 : 0))
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <p className="tabular text-[32px] font-bold" aria-live="polite">
        {hourLabel(hour)}
      </p>
      <div role="radiogroup" aria-label="오전 오후" className="grid grid-cols-2 gap-1 rounded-full bg-surface-muted p-1">
        {(['오전', '오후'] as const).map((l, i) => {
          const on = pm === (i === 1)
          return (
            <button
              key={l}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange(h12 + (i === 1 ? 12 : 0))}
              className={cn('h-9 rounded-full px-6 text-[14px] font-medium', on ? 'bg-surface font-semibold shadow-[0_1px_2px_rgba(15,23,42,0.08)]' : 'text-text-muted')}
            >
              {l}
            </button>
          )
        })}
      </div>
      <svg
        ref={svg}
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        role="slider"
        tabIndex={0}
        aria-label="알림 시각"
        aria-valuemin={0}
        aria-valuemax={23}
        aria-valuenow={hour}
        aria-valuetext={hourLabel(hour)}
        className="touch-none select-none rounded-full outline-none focus-visible:ring-4 focus-visible:ring-icon/25"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId)
          pick(e.clientX, e.clientY)
        }}
        onPointerMove={(e) => e.buttons && pick(e.clientX, e.clientY)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight' || e.key === 'ArrowUp') onChange((hour + 1) % 24)
          else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') onChange((hour + 23) % 24)
          else return
          e.preventDefault()
        }}
      >
        <circle cx={R} cy={R} r={R - 2} fill="var(--surface-muted)" />
        <line x1={R} y1={R} x2={handX} y2={handY} stroke="var(--icon)" strokeWidth={3} strokeLinecap="round" />
        <circle cx={R} cy={R} r={5} fill="var(--icon)" />
        <circle cx={handX} cy={handY} r={20} fill="var(--icon)" opacity={0.18} />
        {Array.from({ length: 12 }, (_, i) => {
          const a = (i / 12) * 2 * Math.PI - Math.PI / 2
          const label = i === 0 ? 12 : i
          const on = i === h12
          return (
            <text
              key={i}
              x={R + Math.cos(a) * NUM_R}
              y={R + Math.sin(a) * NUM_R}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={16}
              fontWeight={on ? 700 : 500}
              fill={on ? 'var(--icon)' : 'var(--text-muted)'}
              aria-hidden
            >
              {label}
            </text>
          )
        })}
      </svg>
      <p className="text-[12px] text-text-subtle">시침을 끌어서 시간을 골라요. 매일 이 시간에 알려드려요.</p>
    </div>
  )
}
