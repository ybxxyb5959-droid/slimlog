import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Scatter, ComposedChart, Tooltip, XAxis, YAxis } from 'recharts'

import { formatShortDate, formatShortDateWithDay } from '@/lib/date'
import type { ResidualPoint } from '@/types/domain'

import { AXIS_TICK, ChartTooltipBox } from './ChartTooltip'

export interface CurveMarker {
  t: number
  label: string
}

/**
 * 참고용 잔존량 곡선 — 상대값(기간 내 최댓값 = 100)만 표시.
 * mg·농도 단위를 절대 붙이지 않는다.
 */
export function ResidualCurveChart({
  points,
  doseMarkers,
  symptomMarkers = [],
  height = 260,
}: {
  points: ResidualPoint[]
  doseMarkers: CurveMarker[]
  symptomMarkers?: CurveMarker[]
  height?: number
}) {
  const symptomData = symptomMarkers.map((s) => ({ t: s.t, y: 4, label: s.label }))
  const hasSymptoms = symptomData.length > 0
  const Chart = hasSymptoms ? ComposedChart : LineChart

  return (
    <div style={{ height }} className="w-full" role="img" aria-label="참고용 잔존량 상대값 곡선">
      <ResponsiveContainer width="100%" height="100%">
        <Chart data={points} margin={{ top: 22, right: 12, bottom: 0, left: -16 }}>
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
            minTickGap={32}
            allowDuplicatedCategory={false}
          />
          <YAxis domain={[0, 100]} ticks={[0, 50, 100]} tick={AXIS_TICK} tickLine={false} axisLine={false} width={40} />
          {doseMarkers.map((m) => (
            <ReferenceLine
              key={m.t}
              x={m.t}
              stroke="var(--text-subtle)"
              strokeDasharray="3 4"
              label={{ value: m.label, position: 'top', fill: 'var(--text-muted)', fontSize: 11, fontWeight: 600 }}
            />
          ))}
          <Tooltip
            cursor={{ stroke: 'var(--text-subtle)', strokeDasharray: '3 3' }}
            content={({ active, payload }) => {
              const p = payload?.find((x) => x.dataKey === 'relative')?.payload as ResidualPoint | undefined
              return active && p ? (
                <ChartTooltipBox
                  title={formatShortDateWithDay(new Date(p.t))}
                  rows={[{ color: 'var(--chart-1)', label: '참고 상대값', value: Math.round(p.relative) }]}
                />
              ) : null
            }}
          />
          <Line
            type="monotone"
            dataKey="relative"
            stroke="var(--chart-1)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 5, stroke: 'var(--surface)', strokeWidth: 2 }}
            isAnimationActive={false}
          />
          {hasSymptoms && (
            <Scatter
              data={symptomData}
              dataKey="y"
              fill="var(--text-muted)"
              stroke="var(--surface)"
              strokeWidth={2}
              shape="circle"
              isAnimationActive={false}
            />
          )}
        </Chart>
      </ResponsiveContainer>
    </div>
  )
}
