import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { formatShortDate } from '@/lib/date'
import type { BodyLog } from '@/types/domain'

import { AXIS_TICK, ChartTooltipBox } from './ChartTooltip'

/** 체중 변화 — 단일 시리즈, 부드러운 곡선(monotone) */
export function WeightChart({ logs, height = 220 }: { logs: BodyLog[]; height?: number }) {
  const data = logs
    .map((l) => ({ t: new Date(l.measuredAt).getTime(), weight: l.weightKg }))
    .sort((a, b) => a.t - b.t)
  const values = data.map((d) => d.weight)
  const min = Math.floor(Math.min(...values) - 1)
  const max = Math.ceil(Math.max(...values) + 1)

  return (
    <div style={{ height }} className="w-full" role="img" aria-label="체중 변화 그래프">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
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
            minTickGap={28}
          />
          <YAxis domain={[min, max]} tick={AXIS_TICK} tickLine={false} axisLine={false} width={44} unit="" />
          <Tooltip
            cursor={{ stroke: 'var(--text-subtle)', strokeDasharray: '3 3' }}
            content={({ active, payload }) =>
              active && payload?.length ? (
                <ChartTooltipBox
                  title={formatShortDate(new Date(payload[0].payload.t))}
                  rows={[{ color: 'var(--chart-1)', label: '체중', value: `${payload[0].payload.weight} kg` }]}
                />
              ) : null
            }
          />
          <Area
            type="monotone"
            dataKey="weight"
            stroke="var(--chart-1)"
            strokeWidth={2}
            fill="var(--chart-1)"
            fillOpacity={0.07}
            dot={false}
            isAnimationActive={false}
            activeDot={{ r: 5, stroke: 'var(--surface)', strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
