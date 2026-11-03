import type * as React from 'react'

/** 차트 공통 툴팁 — 텍스트는 텍스트 토큰, 색 점만 시리즈 색 */
export function ChartTooltipBox({ title, rows }: { title: React.ReactNode; rows: { color?: string; label: string; value: React.ReactNode }[] }) {
  return (
    <div className="rounded-xl border border-border bg-surface px-3 py-2 text-[12px] shadow-[0_4px_16px_rgba(15,23,42,0.08)]">
      <p className="mb-1 font-semibold text-text">{title}</p>
      {rows.map((r) => (
        <p key={r.label} className="flex items-center gap-1.5 text-text-muted">
          {r.color && <span className="inline-block size-2 rounded-full" style={{ background: r.color }} />}
          {r.label}
          <span className="tabular ml-auto pl-3 font-semibold text-text">{r.value}</span>
        </p>
      ))}
    </div>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const AXIS_TICK = { fill: 'var(--text-subtle)', fontSize: 11 }
