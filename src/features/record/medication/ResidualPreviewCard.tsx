import { ShieldOff } from 'lucide-react'
import { useState } from 'react'

import { ResidualCurveChart } from '@/components/charts/ResidualCurveChart'
import { MockBadge } from '@/components/common/MockBadge'
import { Notice, RESIDUAL_DISCLAIMER } from '@/components/common/Notice'
import { EmptyState } from '@/components/common/StateViews'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { buildExampleResidualCurve } from '@/fixtures/residual.mock'
import { addDays, formatShortDate } from '@/lib/date'
import type { Dose, Medication } from '@/types/domain'

/** 참고용 잔존량 곡선 카드 — 투약 입력 화면과 분석 화면에서 함께 쓴다 */
export function ResidualPreviewCard({
  medication,
  doses,
  days = 28,
  symptomTimes = [],
  height,
  compact,
}: {
  medication: Medication
  doses: Dose[]
  days?: number
  symptomTimes?: { t: number; label: string }[]
  height?: number
  compact?: boolean
}) {
  const [now] = useState(() => Date.now())
  const from = addDays(new Date(now), -days).getTime()
  const to = addDays(new Date(now), 3).getTime()
  const points = buildExampleResidualCurve(doses, medication, from, to)
  const markers = doses
    .filter((d) => d.medicationId === medication.id)
    .map((d) => ({ t: new Date(d.administeredAt).getTime(), label: `${d.doseMg}mg` }))
    .filter((m) => m.t >= from && m.t <= to)

  return (
    <Card className="min-w-0">
      <CardHeader className="flex-wrap">
        <div>
          <CardTitle className="text-[17px] font-bold">참고용 잔존량 곡선</CardTitle>
          <p className="mt-0.5 text-[12px] text-text-muted">상대값 (기간 내 최댓값 = 100) · {medication.name}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <Badge tone="review">참고용 계산</Badge>
          <MockBadge />
        </div>
      </CardHeader>

      {points.length === 0 ? (
        <EmptyState
          icon={ShieldOff}
          title="곡선을 만들지 않아요"
          description={
            medication.halfLifeHours === null
              ? `${medication.name}은(는) 반감기 출처가 아직 등록되지 않았어요. 출처가 없는 약은 곡선을 만들지 않습니다.`
              : '이 기간에 투약 기록이 없어요.'
          }
          className="py-8"
        />
      ) : (
        <ResidualCurveChart points={points} doseMarkers={markers} symptomMarkers={symptomTimes} height={height} />
      )}

      <Notice tone="review" className="mt-3">
        {RESIDUAL_DISCLAIMER}
      </Notice>

      {!compact && (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <div className="rounded-xl bg-surface-muted px-4 py-3">
            <p className="text-[12px] text-text-muted">사용한 반감기 값</p>
            {medication.halfLifeSource ? (
              <>
                <p className="mt-0.5 text-[14px] font-semibold">
                  {medication.halfLifeSource.label} · 출처 표시
                </p>
                <p className="mt-0.5 text-[12px] text-text-subtle">{medication.halfLifeSource.note}</p>
              </>
            ) : (
              <p className="mt-0.5 text-[14px] font-semibold">출처 미등록</p>
            )}
          </div>
          <div className="rounded-xl bg-surface-muted px-4 py-3">
            <p className="text-[12px] text-text-muted">이 곡선으로 할 수 없는 것</p>
            <p className="mt-0.5 text-[14px] font-semibold">효과 · 부작용 예측, 용량 판단</p>
          </div>
        </div>
      )}
      {!compact && markers.length > 0 && (
        <p className="mt-3 text-[12px] text-text-subtle">
          표시 기간 {formatShortDate(new Date(from))} ~ {formatShortDate(new Date(to))} · 점선 = 투약 기록
        </p>
      )}
    </Card>
  )
}
