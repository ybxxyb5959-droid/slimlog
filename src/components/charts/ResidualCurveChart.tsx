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

/** 투약 용량 배지 (점선 위쪽) */
function DoseBadge({ viewBox, value }: { viewBox?: { x: number; y: number }; value?: string }) {
  if (!viewBox || !value) return null
  const w = value.length * 6.4 + 12
  return (
    <g transform={`translate(${viewBox.x - w / 2}, ${viewBox.y - 20})`}>
      <rect width={w} height={18} rx={9} fill="var(--surface)" stroke="var(--border)" />
      <text x={w / 2} y={12.5} textAnchor="middle" fontSize={11} fontWeight={600} fill="var(--text-muted)">
        {value}
      </text>
    </g>
  )
}

/**
 * 참고용 잔존량 곡선 — 상대값(표시 기간 최댓값 = 100)만 그린다. mg·농도 단위 금지.
 * 보간: monotone (단조 보간 → 데이터 사이에 없는 최고점을 만들지 않음).
 * 샘플에는 투약 직전·직후 시각이 들어 있어 최고점 위치가 어긋나지 않는다.
 */
export function ResidualCurveChart({
  points,
  doseMarkers,
  now,
  nowValue,
  symptomTimes = [],
  height = 220,
}: {
  points: RelativePoint[]
  doseMarkers: CurveMarker[]
  now: number
  nowValue: number | null
  /** 증상 기록 시각 — 곡선 아래쪽 회색 점 */
  symptomTimes?: number[]
  height?: number
}) {
  return (
    <div style={{ height }} className="w-full" role="img" aria-label="참고용 잔존량 상대값 곡선">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 26, right: 18, bottom: 0, left: -6 }}>
          <defs>
            <linearGradient id="residualFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={LINE} stopOpacity={0.26} />
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
            minTickGap={36}
          />
          <YAxis domain={[0, 100]} ticks={[0, 50, 100]} tick={AXIS_TICK} tickLine={false} axisLine={false} width={34} />
          {doseMarkers.map((m) => (
            <ReferenceLine
              key={m.t}
              x={m.t}
              stroke="var(--text-subtle)"
              strokeDasharray="3 4"
              label={m.showBadge ? <DoseBadge value={`${m.doseMg}mg`} /> : undefined}
            />
          ))}
          <ReferenceLine x={now} stroke="var(--text)" strokeOpacity={0.35} />
          <Tooltip
            cursor={{ stroke: 'var(--text-subtle)', strokeDasharray: '3 3' }}
            content={({ active, payload }) => {
              const p = payload?.[0]?.payload as RelativePoint | undefined
              if (!active || !p) return null
              const dose = doseMarkers.find((m) => Math.abs(m.t - p.t) < 90 * 60 * 1000)
              return (
                <div className="rounded-xl border border-border bg-surface px-3 py-2 text-[12px] shadow-[0_4px_16px_rgba(15,23,42,0.08)]">
                  <p className="tabular font-semibold text-text">
                    {formatShortDateWithDay(new Date(p.t))} {formatTime(new Date(p.t))}
                  </p>
                  <p className="tabular mt-0.5 text-text-muted">
                    최고 시점 대비 <b className="text-text">{Math.round(p.relative)}%</b>
                  </p>
                  {dose && <p className="tabular text-text-muted">투약 {dose.doseMg}mg</p>}
                </div>
              )
            }}
          />
          <Area
            type="monotone"
            dataKey="relative"
            stroke={LINE}
            strokeWidth={2.5}
            fill="url(#residualFill)"
            dot={false}
            activeDot={{ r: 5, fill: LINE, stroke: 'var(--surface)', strokeWidth: 2 }}
            isAnimationActive={false}
          />
          {symptomTimes.map((t) => (
            <ReferenceDot key={`s${t}`} x={t} y={4} r={4} fill="var(--text-muted)" stroke="var(--surface)" strokeWidth={2} />
          ))}
          {nowValue !== null && (
            <ReferenceDot
              x={now}
              y={nowValue}
              r={6}
              fill={LINE}
              stroke="var(--surface)"
              strokeWidth={2.5}
              label={{ value: '오늘', position: 'top', fill: 'var(--text)', fontSize: 11, fontWeight: 700, offset: 10 }}
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
