import { useEffect, useRef, useState } from 'react'
import { Area, AreaChart, CartesianGrid, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { formatShortDate, formatShortDateWithDay, formatTime } from '@/lib/date'
import type { RelativePoint } from '@/lib/pk/residual'

import { AXIS_TICK } from './ChartTooltip'

export interface CurveMarker {
  t: number
  doseMg: number
  /** 배지를 보여줄지 (촘촘할 때 일부만) */
  showBadge: boolean
}

const LINE = 'var(--chart-residual)'
const PLOT_TOP = 12

/** 투약 용량 세로 배지 — 점선 위쪽, 그래프 안쪽 */
function DoseBadge({ viewBox, value }: { viewBox?: { x: number; y: number }; value?: string }) {
  if (!viewBox || !value) return null
  const h = value.length * 6.6 + 14
  return (
    <g transform={`translate(${viewBox.x - 10}, ${viewBox.y})`} aria-hidden>
      <rect width={20} height={h} rx={6} fill="var(--text)" fillOpacity={0.78} />
      <text x={10} y={7} fontSize={11} fontWeight={600} fill="var(--surface)" transform={`rotate(90 10 7)`} dominantBaseline="middle">
        {value}
      </text>
    </g>
  )
}

/** 선택한 시점의 값 말풍선 */
function Bubble({ viewBox, point, chartWidth, unit }: { viewBox?: { x: number; y: number }; point: RelativePoint; chartWidth: number; unit: 'percent' | 'mg' }) {
  if (!viewBox) return null
  const w = 96
  const h = 42
  const below = viewBox.y < h + 20
  let left = viewBox.x - w / 2
  left = Math.max(4, Math.min(left, chartWidth - w - 4))
  const top = below ? viewBox.y + 14 : viewBox.y - h - 14
  const arrowX = Math.max(left + 10, Math.min(viewBox.x, left + w - 10))
  const d = new Date(point.t)
  return (
    <g pointerEvents="none">
      <rect x={left} y={top} width={w} height={h} rx={10} fill="var(--text)" />
      <path
        d={below ? `M${arrowX - 6} ${top} L${arrowX} ${top - 6} L${arrowX + 6} ${top} Z` : `M${arrowX - 6} ${top + h} L${arrowX} ${top + h + 6} L${arrowX + 6} ${top + h} Z`}
        fill="var(--text)"
      />
      <text className="residual-bubble-value" x={left + w / 2} y={top + 17} textAnchor="middle" fontSize={14} fontWeight={700} fill="var(--surface)">
        {unit === 'mg' ? `${point.relative.toFixed(2)}mg` : `${Math.round(point.relative)}%`}
      </text>
      <text x={left + w / 2} y={top + 33} textAnchor="middle" fontSize={10.5} fill="var(--surface)" fillOpacity={0.75}>
        {formatShortDate(d)} {formatTime(d)}
      </text>
    </g>
  )
}

/**
 * 참고용 잔존량 곡선 — 체내 추정량(mg) 또는 상대값(표시 기간 최댓값 = 100). 실제 혈중농도가 아니라 모델 추정치.
 * 그래프를 누르거나(터치 후 좌우로 끌기) 클릭하면 그 시점의 값을 말풍선으로 고정해 보여준다.
 * 보간: monotone (데이터 사이에 없는 최고점을 만들지 않음).
 */
export function ResidualCurveChart({
  points,
  doseMarkers,
  now,
  nowValue,
  symptomTimes = [],
  height = 240,
  prevPoints,
  unit = 'percent',
}: {
  points: RelativePoint[]
  doseMarkers: CurveMarker[]
  now: number
  nowValue: number | null
  symptomTimes?: number[]
  height?: number
  /** 약을 바꾼 경우 이전 약 곡선 (회색 점선, 따로 계산 · 더하지 않음) */
  prevPoints?: RelativePoint[]
  /** percent: 기간 최고점=100 상대값 / mg: 체내 추정량 (point.relative 칸에 mg) */
  unit?: 'percent' | 'mg'
}) {
  const wrap = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  // 기본 선택 = 오늘(가장 마지막 점)
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null)
  const idx = selectedIdx !== null && selectedIdx < points.length ? selectedIdx : points.length - 1
  const selected = points[idx]

  useEffect(() => {
    const el = wrap.current
    if (!el) return
    const ro = new ResizeObserver(() => setWidth(el.clientWidth))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // 누른 위치(x)를 시각으로 바꿔 가장 가까운 점을 고른다 — 탭·드래그·클릭 모두
  const PLOT_LEFT = 4
  const Y_AXIS_W = 42
  const pressed = useRef(false)
  const pickAt = (clientX: number) => {
    const el = wrap.current
    if (!el || points.length < 2) return
    const r = el.getBoundingClientRect()
    const plotW = r.width - PLOT_LEFT - Y_AXIS_W
    const ratio = Math.min(1, Math.max(0, (clientX - r.left - PLOT_LEFT) / plotW))
    const t0 = points[0].t
    const t = t0 + ratio * (points[points.length - 1].t - t0)
    let best = 0
    for (let i = 1; i < points.length; i++) if (Math.abs(points[i].t - t) < Math.abs(points[best].t - t)) best = i
    setSelectedIdx(best)
  }
  const dose = selected && doseMarkers.find((m) => Math.abs(m.t - selected.t) < 90 * 60 * 1000)
  // mg: 보기 좋은 눈금 (0.5·1·2·5 단위)
  const dataMax = Math.max(0.01, ...points.map((p) => p.relative), ...(prevPoints ?? []).map((p) => p.relative))
  const step = unit === 'mg' ? [0.25, 0.5, 1, 2, 2.5, 5, 10, 20].find((s) => dataMax * 1.08 <= s * 4) ?? 50 : 25
  const yMax = unit === 'mg' ? step * 4 : 100
  const yTicks = [0, 1, 2, 3, 4].map((i) => i * step)
  const fmtVal = (v: number) => (unit === 'mg' ? `${v.toFixed(2)}mg` : `${Math.round(v)}%`)

  return (
    <div
      ref={wrap}
      style={{ height }}
      className="w-full touch-pan-y select-none"
      onPointerDown={(e) => {
        pressed.current = true
        pickAt(e.clientX)
      }}
      onPointerMove={(e) => pressed.current && pickAt(e.clientX)}
      onPointerUp={() => (pressed.current = false)}
      onPointerLeave={() => (pressed.current = false)}
      onPointerCancel={() => (pressed.current = false)}
    >
      <div className="sr-only" aria-live="polite">
        {selected && `${formatShortDateWithDay(new Date(selected.t))} ${formatTime(new Date(selected.t))}, ${unit === 'mg' ? '체내 추정' : '최고 시점 대비'} ${fmtVal(selected.relative)}${dose ? `, 투약 ${dose.doseMg}mg` : ''}`}
      </div>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={points}
          margin={{ top: PLOT_TOP, right: 0, bottom: 0, left: PLOT_LEFT }}
          role="img"
          aria-label={unit === 'mg' ? '체내 추정량(mg) 곡선. 누르면 그 시점의 값을 보여줍니다' : '참고용 잔존량 상대값 곡선. 누르면 그 시점의 값을 보여줍니다'}
        >
          <defs>
            <linearGradient id="residualFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={LINE} stopOpacity={0.24} />
              <stop offset="100%" stopColor={LINE} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis
            dataKey="t"
            type="number"
            scale="time"
            domain={['dataMin', 'dataMax']}
            tickFormatter={(t: number) => formatShortDate(new Date(t))}
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={false}
            minTickGap={30}
          />
          <YAxis
            orientation="right"
            domain={[0, yMax]}
            ticks={yTicks}
            tickFormatter={(v: number) => (unit === 'mg' ? (v === 0 ? '0' : `${step < 1 ? v.toFixed(2) : v}mg`) : `${v}%`)}
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={false}
            width={Y_AXIS_W}
          />
          {doseMarkers.map((m, i) => (
            <ReferenceLine
              key={`${m.t}-${i}`}
              x={m.t}
              stroke="var(--text-muted)"
              strokeDasharray="4 4"
              label={m.showBadge ? <DoseBadge value={`${m.doseMg}mg`} /> : undefined}
            />
          ))}
          <ReferenceLine x={now} stroke="var(--text)" strokeOpacity={0.25} />
          {/* 호버 시 세로 안내선만 (값은 누르면 말풍선으로) */}
          <Tooltip cursor={{ stroke: 'var(--text-subtle)', strokeDasharray: '3 3' }} content={() => null} />
          {prevPoints && prevPoints.length > 0 && (
            <Area
              data={prevPoints}
              type="monotone"
              dataKey="relative"
              stroke="var(--text-subtle)"
              strokeWidth={2}
              strokeDasharray="5 4"
              fill="none"
              dot={false}
              activeDot={false}
              isAnimationActive={false}
            />
          )}
          <Area
            type="monotone"
            dataKey="relative"
            stroke={LINE}
            strokeWidth={2.5}
            fill="url(#residualFill)"
            dot={false}
            activeDot={false}
            isAnimationActive={false}
          />
          {symptomTimes.map((t) => (
            <ReferenceDot key={`s${t}`} x={t} y={yMax * 0.04} r={4} fill="var(--text-muted)" stroke="var(--surface)" strokeWidth={2} />
          ))}
          {nowValue !== null && selected?.t !== points.at(-1)?.t && (
            <ReferenceDot x={now} y={nowValue} r={5} fill={LINE} stroke="var(--surface)" strokeWidth={2} />
          )}
          {selected && (
            <>
              <ReferenceLine x={selected.t} stroke={LINE} strokeOpacity={0.35} strokeDasharray="2 3" />
              <ReferenceDot
                x={selected.t}
                y={selected.relative}
                r={6}
                fill="var(--surface)"
                stroke={LINE}
                strokeWidth={2.5}
                label={<Bubble point={selected} chartWidth={width - Y_AXIS_W} unit={unit} />}
              />
            </>
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
