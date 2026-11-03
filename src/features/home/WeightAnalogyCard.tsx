import { ChevronRight, Scale } from 'lucide-react'
import type * as React from 'react'
import { Link } from 'react-router'

import { AppIcon } from '@/components/common/AppIcon'
import { AnalogyIllustration } from '@/components/illustrations/AnalogyIllustration'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { summarizeWeightChange } from '@/lib/weightAnalogy'

/**
 * 체중 카드 — 감량한 무게를 일상 물건에 비유한다.
 * 감량이 없거나 늘었으면 판단 없는 중립 요약만 보여준다. 그래프는 분석 탭에서 본다.
 * variant="hero": 홈 최상단 메인 카드
 */
export function WeightAnalogyCard({
  startKg,
  latestKg,
  to = '/analysis',
  variant = 'card',
  eyebrow,
}: {
  startKg: number
  latestKg: number
  to?: string
  variant?: 'card' | 'hero'
  /** hero 상단 한 줄 (날짜·인사) */
  eyebrow?: React.ReactNode
}) {
  const s = summarizeWeightChange(startKg, latestKg)
  const isLoss = s.kind === 'loss'
  const hero = variant === 'hero'

  return (
    <Link to={to} className="group block h-full" aria-label="체중 변화 자세히 보기">
      <Card className={cn('flex h-full flex-col transition-colors group-hover:bg-surface-muted/40', hero && 'p-6 md:p-8')}>
        <div className="mb-1 flex items-start justify-between gap-3">
          {hero && eyebrow ? (
            <div className="min-w-0 text-[13px] text-text-muted">{eyebrow}</div>
          ) : (
            <p className="flex items-center gap-2 text-[15px] font-medium text-text-muted">
              <AppIcon icon={Scale} size="sm" /> 체중 변화
            </p>
          )}
          <AppIcon icon={ChevronRight} size="sm" tone="muted" />
        </div>

        <div className={cn('flex items-start gap-3', hero && 'mt-2 items-center gap-4 md:gap-8')}>
          <div className="min-w-0 flex-1">
            <p
              className={cn(
                'leading-snug font-bold tracking-tight text-balance break-keep text-text',
                hero ? 'text-[22px] md:text-[26px]' : 'mt-1 text-[16px]',
              )}
            >
              {isLoss
                ? s.beyond
                  ? `${s.analogy.name}보다 더 가벼워졌어요`
                  : `${s.analogy.name} 정도 가벼워졌어요`
                : '시작 체중과 비교한 기록이에요'}
            </p>
            <p className={cn('text-text-muted', hero ? 'mt-3 text-[14px]' : 'mt-1.5 text-[13px]')}>
              {isLoss ? '총 감량 체중' : '시작 대비'}
            </p>
            <p
              className={cn(
                'tabular leading-tight font-bold tracking-tight',
                isLoss ? 'text-primary' : 'text-text',
                hero ? 'text-[40px] md:text-[48px]' : 'text-[28px]',
              )}
            >
              {isLoss ? '−' : s.diffKg > 0 ? '+' : s.diffKg < 0 ? '−' : '±'}
              {(isLoss ? s.lossKg : Math.abs(s.diffKg)).toFixed(1)}
              <span className={cn('ml-0.5 font-semibold', hero ? 'text-[18px]' : 'text-[15px]', !isLoss && 'text-text-muted')}>kg</span>
            </p>
            <p className={cn('tabular text-text-muted', hero ? 'mt-1 text-[14px]' : 'mt-0.5 text-[13px]')}>
              시작 {startKg.toFixed(1)}kg → 현재 {latestKg.toFixed(1)}kg
            </p>
          </div>
          <span
            className={cn(
              'flex shrink-0 items-center justify-center rounded-2xl bg-icon-soft/70',
              hero ? 'size-24 rounded-3xl md:size-32' : 'mt-1 size-16',
            )}
          >
            <AnalogyIllustration id={isLoss ? s.analogy.id : 'scale'} className={hero ? 'size-16 md:size-20' : 'size-11'} />
          </span>
        </div>

        {isLoss && (
          <p className={cn('mt-auto leading-relaxed break-keep text-text-subtle', hero ? 'pt-4 text-[12px]' : 'pt-2 text-[11px]')}>
            {s.analogy.name} 약 {s.analogy.approxKg}kg 기준 · 물건마다 무게가 달라 대략적인 비유예요
          </p>
        )}
      </Card>
    </Link>
  )
}
