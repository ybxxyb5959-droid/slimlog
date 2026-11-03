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

/**
 * 새 사용자용 메인 카드 — 기록이 0~1건일 때.
 * 허위 감량량·그래프를 만들지 않고, 입력한 시작·목표만 보여준다.
 */
export function WeightStartCard({
  startKg,
  goalKg,
  eyebrow,
}: {
  startKg: number | null
  goalKg: number | null
  eyebrow?: React.ReactNode
}) {
  const empty = startKg === null
  const diff = startKg !== null && goalKg !== null ? Math.round((goalKg - startKg) * 10) / 10 : null
  return (
    <Card className="p-6 md:p-8">
      {eyebrow && <div className="text-[13px] text-text-muted">{eyebrow}</div>}
      <div className="mt-3 flex items-center gap-4 md:gap-8">
        <div className="min-w-0 flex-1">
          <p className="text-[22px] leading-snug font-bold tracking-tight text-balance break-keep md:text-[26px]">
            {empty ? '시작 체중을 기록해 볼까요?' : '첫 기록을 시작했어요'}
          </p>
          {empty ? (
            <p className="mt-2 text-[14px] leading-relaxed break-keep text-text-muted">
              체중을 기록하면 줄어든 무게를 일상 물건에 비유해 보여드려요.
            </p>
          ) : (
            <dl className="tabular mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-surface-muted px-4 py-3">
                <dt className="text-[13px] text-text-muted">시작 체중</dt>
                <dd className="text-[24px] font-bold">
                  {startKg!.toFixed(1)}
                  <span className="ml-0.5 text-[14px] font-semibold text-text-muted">kg</span>
                </dd>
              </div>
              <div className="rounded-2xl bg-primary-soft px-4 py-3">
                <dt className="text-[13px] text-primary/80">내가 정한 목표</dt>
                <dd className="text-[24px] font-bold text-primary">
                  {goalKg !== null ? goalKg.toFixed(1) : '—'}
                  <span className="ml-0.5 text-[14px] font-semibold">kg</span>
                </dd>
              </div>
            </dl>
          )}
          {diff !== null && (
            <p className="tabular mt-3 text-[13px] text-text-muted">
              목표까지 {diff > 0 ? '+' : diff < 0 ? '−' : ''}
              {Math.abs(diff).toFixed(1)}kg · 다음 체중을 기록하면 변화가 여기에 보여요
            </p>
          )}
        </div>
        <span className="hidden size-24 shrink-0 items-center justify-center rounded-3xl bg-icon-soft/70 sm:flex md:size-32">
          <AnalogyIllustration id="scale" className="size-16 md:size-20" />
        </span>
      </div>
      <Link
        to={empty ? '/my/body' : '/record/body'}
        className="mt-5 inline-flex h-11 items-center justify-center rounded-xl bg-primary px-5 text-[15px] font-semibold text-primary-foreground hover:bg-primary-hover"
      >
        {empty ? '신체 정보 입력하기' : '오늘 체중 기록하기'}
      </Link>
    </Card>
  )
}
