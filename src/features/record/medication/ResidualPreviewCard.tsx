import { Info, ShieldOff } from 'lucide-react'
import { useMemo, useState } from 'react'

import { ResidualCurveChart, type CurveMarker } from '@/components/charts/ResidualCurveChart'
import { AppIcon } from '@/components/common/AppIcon'
import { MockBadge } from '@/components/common/MockBadge'
import { RESIDUAL_DISCLAIMER } from '@/components/common/Notice'
import { EmptyState } from '@/components/common/StateViews'
import { Card } from '@/components/ui/card'
import { DAY_MS } from '@/lib/date'
import { relativeAt, relativeCurve, type DoseEvent } from '@/lib/pk/residual'
import { cn } from '@/lib/utils'
import type { Dose, Medication } from '@/types/domain'

import { ResidualInfoSheet } from './ResidualInfoSheet'

const PERIODS = [
  { days: 14, label: '2주' },
  { days: 30, label: '1개월' },
  { days: 90, label: '3개월' },
] as const

function elapsedText(ms: number) {
  const h = Math.floor(ms / (3600 * 1000))
  const d = Math.floor(h / 24)
  return d > 0 ? `${d}일 ${h % 24}시간` : `${h}시간`
}

/** 참고용 잔존량 곡선 카드 — 투약 입력·분석 허브·분석 상세에서 함께 쓴다 */
export function ResidualPreviewCard({
  medication,
  doses,
  defaultDays = 30,
  symptomTimes = [],
  height = 220,
}: {
  medication: Medication
  doses: Dose[]
  defaultDays?: 14 | 30 | 90
  symptomTimes?: number[]
  height?: number
}) {
  const [days, setDays] = useState<number>(defaultDays)
  const [info, setInfo] = useState(false)
  const [now] = useState(() => Date.now())
  const from = now - days * DAY_MS
  const halfLife = medication.pk.halfLifeHours?.value ?? null

  const events: DoseEvent[] = useMemo(
    () =>
      doses
        .filter((d) => d.medicationId === medication.id)
        .map((d) => ({ t: new Date(d.administeredAt).getTime(), doseMg: d.doseMg }))
        .filter((d) => d.t <= now)
        .sort((a, b) => a.t - b.t),
    [doses, medication.id, now],
  )
  const points = useMemo(() => relativeCurve(events, halfLife, from, now), [events, halfLife, from, now])
  const nowValue = relativeAt(points, now)
  const inRange = events.filter((e) => e.t >= from)
  const markers: CurveMarker[] = inRange.map((e, i) => ({
    t: e.t,
    doseMg: e.doseMg,
    // 촘촘하면 용량이 바뀐 지점과 마지막 투약만 배지 표시
    showBadge: days <= 30 || i === 0 || i === inRange.length - 1 || e.doseMg !== inRange[i - 1].doseMg,
  }))
  const last = events.at(-1)

  return (
    <Card className="min-w-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-text-muted">현재 참고 수준</p>
          {nowValue !== null ? (
            <p className="tabular mt-0.5 text-[32px] leading-tight font-bold tracking-tight text-text">
              {Math.round(nowValue)}
              <span className="ml-0.5 text-[16px] font-semibold text-text-muted">%</span>
            </p>
          ) : (
            <p className="mt-0.5 text-[20px] font-bold text-text-subtle">계산 없음</p>
          )}
          <p className="text-[12px] break-keep text-text-muted">
            표시 기간 최고 시점 대비 · {medication.name} · 반감기 기반 참고 계산
          </p>
          {last && nowValue !== null && (
            <p className="tabular mt-0.5 text-[12px] text-text-subtle">
              마지막 투약 {last.doseMg}mg 후 {elapsedText(now - last.t)} 경과
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <MockBadge />
          <button
            type="button"
            onClick={() => setInfo(true)}
            className="inline-flex size-10 items-center justify-center rounded-full hover:bg-surface-muted"
            aria-label="참고용 잔존량 계산 안내 보기"
          >
            <AppIcon icon={Info} size="sm" tone="muted" />
          </button>
        </div>
      </div>

      <div role="radiogroup" aria-label="그래프 기간" className="mt-3 inline-flex rounded-xl bg-surface-muted p-1">
        {PERIODS.map((p) => (
          <button
            key={p.days}
            type="button"
            role="radio"
            aria-checked={days === p.days}
            onClick={() => setDays(p.days)}
            className={cn(
              'h-8 min-w-14 rounded-lg px-3 text-[13px] font-medium',
              days === p.days ? 'bg-surface font-semibold text-text shadow-[0_1px_2px_rgba(15,23,42,0.08)]' : 'text-text-muted',
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="mt-2">
        {points.length === 0 ? (
          <EmptyState
            icon={ShieldOff}
            title={halfLife === null ? '곡선을 만들지 않아요' : '이 기간에 투약 기록이 없어요'}
            description={
              halfLife === null
                ? `${medication.name}은(는) 반감기 출처를 확인하지 못했어요. 출처가 없는 약은 곡선을 만들지 않습니다.`
                : `${medication.name} 투약을 기록하면 여기에 표시돼요.`
            }
            className="py-8"
          />
        ) : (
          <ResidualCurveChart
            points={points}
            doseMarkers={markers}
            now={now}
            nowValue={nowValue}
            symptomTimes={symptomTimes.filter((t) => t >= from && t <= now)}
            height={height}
          />
        )}
      </div>

      <p className="mt-2 text-[12px] leading-relaxed text-text-subtle">{RESIDUAL_DISCLAIMER}</p>

      <ResidualInfoSheet open={info} onClose={() => setInfo(false)} medication={medication} />
    </Card>
  )
}
