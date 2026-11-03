import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { formatShortDate } from '@/lib/date'
import type { BodyLog } from '@/types/domain'

import { AXIS_TICK, ChartTooltipBox } from './ChartTooltip'

const SERIES = [
  { key: 'skeletalMuscleKg', name: '골격근량', color: 'var(--chart-1)' },
  { key: 'bodyFatKg', name: '체지방량', color: 'var(--chart-2)' },
] as const

/** 체성분 추이 — 두 항목 모두 kg이라 하나의 축 */
export function BodyCompositionChart({ logs, height = 240 }: { logs: BodyLog[]; height?: number }) {
  const data = logs.map((l) => ({ t: new Date(l.measuredAt).getTime(), skeletalMuscleKg: l.skeletalMuscleKg, bodyFatKg: l.bodyFatKg }))
  return (
    <div style={{ height }} className="w-full" role="img" aria-label="골격근량·체지방량 추이 그래프">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
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
          <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={44} domain={['dataMin - 3', 'dataMax + 3']} tickFormatter={(v: number) => `${Math.round(v)}`} />
          <Legend verticalAlign="top" align="left" iconType="circle" iconSize={8} height={28} wrapperStyle={{ fontSize: 12, color: 'var(--text-muted)' }} />
          <Tooltip
            cursor={{ stroke: 'var(--text-subtle)', strokeDasharray: '3 3' }}
            content={({ active, payload }) =>
              active && payload?.length ? (
                <ChartTooltipBox
                  title={formatShortDate(new Date(payload[0].payload.t))}
                  rows={SERIES.map((s) => ({ color: s.color, label: s.name, value: `${payload[0].payload[s.key]} kg` }))}
                />
              ) : null
            }
          />
          {SERIES.map((s) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.name}
              stroke={s.color}
              strokeWidth={2}
              dot={{ r: 4, fill: s.color, stroke: 'var(--surface)', strokeWidth: 2 }}
              activeDot={{ r: 6 }}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
