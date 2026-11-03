import { ChevronRight, Scale } from 'lucide-react'
import { Link } from 'react-router'

import { AppIcon } from '@/components/common/AppIcon'
import { AnalogyIllustration } from '@/components/illustrations/AnalogyIllustration'
import { Card } from '@/components/ui/card'
import { summarizeWeightChange } from '@/lib/weightAnalogy'

/**
 * 홈 체중 카드 — 감량한 무게를 일상 물건에 비유한다.
 * 감량이 없거나 늘었으면 판단 없는 중립 요약만 보여준다.
 * 그래프는 분석 탭(바디 변화)에서 본다.
 */
export function WeightAnalogyCard({
  startKg,
  latestKg,
  to = '/analysis',
}: {
  startKg: number
  latestKg: number
  to?: string
}) {
  const s = summarizeWeightChange(startKg, latestKg)
  const isLoss = s.kind === 'loss'

  return (
    <Link to={to} className="group block h-full" aria-label="체중 변화 자세히 보기">
      <Card className="flex h-full flex-col transition-colors group-hover:bg-surface-muted/40">
        <div className="mb-1 flex items-start justify-between gap-3">
          <p className="flex items-center gap-2 text-[15px] font-medium text-text-muted">
            <AppIcon icon={Scale} size="sm" /> 체중 변화
          </p>
          <AppIcon icon={ChevronRight} size="sm" tone="muted" />
        </div>
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">

        {isLoss ? (
          <>
            <p className="mt-1 text-[16px] leading-snug font-bold tracking-tight text-balance break-keep text-text">
              {s.beyond ? `${s.analogy.name}보다 더 가벼워졌어요` : `${s.analogy.name} 정도 가벼워졌어요`}
            </p>
            <p className="mt-1.5 text-[13px] text-text-muted">총 감량 체중</p>
            <p className="tabular text-[28px] leading-tight font-bold tracking-tight text-primary">
              −{s.lossKg.toFixed(1)}
              <span className="ml-0.5 text-[15px] font-semibold">kg</span>
            </p>
          </>
        ) : (
          <>
            <p className="mt-1 text-[16px] leading-snug font-bold tracking-tight break-keep text-text">시작 체중과 비교한 기록이에요</p>
            <p className="mt-1.5 text-[13px] text-text-muted">시작 대비</p>
            <p className="tabular text-[28px] leading-tight font-bold tracking-tight text-text">
              {s.diffKg > 0 ? '+' : s.diffKg < 0 ? '−' : '±'}
              {Math.abs(s.diffKg).toFixed(1)}
              <span className="ml-0.5 text-[15px] font-semibold text-text-muted">kg</span>
            </p>
          </>
        )}

        <p className="tabular mt-0.5 text-[13px] text-text-muted">
          {startKg.toFixed(1)}kg → {latestKg.toFixed(1)}kg
        </p>
          </div>
          <span className="mt-1 flex size-16 shrink-0 items-center justify-center rounded-2xl bg-icon-soft/70">
            <AnalogyIllustration id={isLoss ? s.analogy.id : 'scale'} className="size-11" />
          </span>
        </div>
        {isLoss && (
          <p className="mt-auto pt-2 text-[11px] leading-relaxed break-keep text-text-subtle">
            {s.analogy.name} 약 {s.analogy.approxKg}kg 기준 · 물건마다 무게가 달라 대략적인 비유예요
          </p>
        )}
      </Card>
    </Link>
  )
}
