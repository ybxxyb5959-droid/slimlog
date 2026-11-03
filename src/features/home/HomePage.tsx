import {
  Activity,
  CalendarClock,
  ChevronRight,
  GlassWater,
  Pill,
  Scale,
  Syringe,
  Utensils,
} from 'lucide-react'
import { Link } from 'react-router'

import { AppIcon } from '@/components/common/AppIcon'
import { MockBadge } from '@/components/common/MockBadge'
import { Notice, TIMELINE_DISCLAIMER } from '@/components/common/Notice'
import { ErrorState, LoadingState } from '@/components/common/StateViews'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { MEDICATIONS, siteLabel } from '@/fixtures/medications.mock'
import { SYMPTOM_LABEL } from '@/fixtures/records.mock'
import { addDays, daysBetween, formatShortDateWithDay, formatTime, greetingFor } from '@/lib/date'
import { useAsync } from '@/lib/useAsync'
import { cn } from '@/lib/utils'
import { useDoses } from '@/services/doses'
import { getHomeSummary } from '@/services/records'

import { HomeTimeline } from './HomeTimeline'

const CONDITION_LABEL = ['', '많이 힘듦', '조금 힘듦', '보통', '좋음', '아주 좋음'] as const

const QUICK = [
  { to: '/record/meal/new', label: '식단', icon: Utensils },
  { to: '/record/body', label: '체중', icon: Scale },
  { to: '/record/symptom', label: '증상', icon: Activity },
  { to: '/record/medication/new', label: '투약', icon: Syringe },
]

export function HomePage() {
  const { data, loading, error, reload } = useAsync(getHomeSummary)
  const doses = useDoses()
  const now = new Date()

  if (loading) return <LoadingState className="min-h-[60vh]" />
  if (error || !data)
    return <ErrorState description="잠시 후 다시 시도해 주세요." action={<Button onClick={reload}>다시 불러오기</Button>} />

  const { profile, bodyLogs, todayMeals, todayCheck, symptoms, timeline, weeklyStatus } = data
  const sortedLogs = [...bodyLogs].sort((a, b) => a.measuredAt.localeCompare(b.measuredAt))
  const latest = sortedLogs[sortedLogs.length - 1]
  const weekAgo = sortedLogs.filter((l) => daysBetween(new Date(l.measuredAt), now) >= 7).at(-1)
  const diffStart = latest.weightKg - profile.startWeightKg
  const diffWeek = weekAgo ? latest.weightKg - weekAgo.weightKg : null
  const kcal = todayMeals.reduce((a, m) => a + m.kcal, 0)
  const carb = todayMeals.reduce((a, m) => a + m.carbG, 0)
  const fat = todayMeals.reduce((a, m) => a + m.fatG, 0)
  const proteinPct = Math.min(100, Math.round((todayCheck.proteinG / todayCheck.proteinGoalG) * 100))

  const lastDose = doses[0]
  const nextDue = lastDose ? addDays(new Date(lastDose.administeredAt), 7) : null
  const nextIn = nextDue ? daysBetween(now, nextDue) : null
  const recentSymptoms = [...symptoms].sort((a, b) => b.recordedAt.localeCompare(a.recordedAt)).slice(0, 3)

  return (
    <div className="space-y-4">
      {/* 인사 */}
      <header className="flex items-end justify-between gap-3 pb-1">
        <div>
          <p className="text-[13px] font-medium text-text-muted">
            {now.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
          </p>
          <h1 className="mt-1 text-[22px] leading-tight font-bold tracking-tight md:text-2xl">
            {profile.nickname}님, {greetingFor(now)}
          </h1>
        </div>
        <MockBadge />
      </header>

      {/* 빠른 기록 */}
      <nav aria-label="빠른 기록" className="grid grid-cols-4 gap-2 md:max-w-xl">
        {QUICK.map((q) => (
          <Link
            key={q.to}
            to={q.to}
            className="flex h-[76px] flex-col items-center justify-center gap-1.5 rounded-card border border-border bg-surface text-[13px] font-medium text-text transition-colors hover:bg-surface-muted"
          >
            <AppIcon icon={q.icon} size="md" bg="soft" className="size-9 rounded-[10px]" />
            {q.label}
          </Link>
        ))}
      </nav>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {/* 체중 */}
        <Link to="/analysis/body" className="group">
          <Card className="h-full transition-colors group-hover:bg-surface-muted/40">
            <CardHeader className="mb-1">
              <CardTitle className="flex items-center gap-2 font-medium text-text-muted">
                <AppIcon icon={Scale} size="sm" /> 현재 체중
              </CardTitle>
              <AppIcon icon={ChevronRight} size="sm" tone="muted" />
            </CardHeader>
            <p className="tabular text-[32px] leading-tight font-bold tracking-tight">
              {latest.weightKg.toFixed(1)}
              <span className="ml-1 text-base font-semibold text-text-muted">kg</span>
            </p>
            <p className="tabular mt-1 text-[14px] font-semibold text-primary">
              시작 대비 {diffStart > 0 ? '+' : ''}
              {diffStart.toFixed(1)}kg ({((diffStart / profile.startWeightKg) * 100).toFixed(1)}%)
            </p>
            {diffWeek !== null && (
              <p className="tabular mt-0.5 text-[13px] text-text-muted">
                최근 7일 {diffWeek > 0 ? '+' : ''}
                {diffWeek.toFixed(1)}kg
              </p>
            )}
          </Card>
        </Link>

        {/* 오늘 섭취 */}
        <Link to="/record/meal" className="group">
          <Card className="h-full transition-colors group-hover:bg-surface-muted/40">
            <CardHeader className="mb-1">
              <CardTitle className="flex items-center gap-2 font-medium text-text-muted">
                <AppIcon icon={Utensils} size="sm" /> 오늘 섭취
              </CardTitle>
              <span className="text-[12px] text-text-subtle">{todayMeals.length}끼 기록</span>
            </CardHeader>
            <p className="tabular text-[32px] leading-tight font-bold tracking-tight">
              {kcal.toLocaleString()}
              <span className="ml-1 text-base font-semibold text-text-muted">kcal</span>
            </p>
            <p className="tabular mt-2 text-[14px]">
              단백질 <b className="text-primary">{todayCheck.proteinG}g</b>
              <span className="text-text-muted"> / 목표 {todayCheck.proteinGoalG}g</span>
            </p>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-muted" role="progressbar" aria-valuenow={proteinPct} aria-valuemin={0} aria-valuemax={100} aria-label="단백질 목표 대비">
              <div className="h-full rounded-full bg-primary" style={{ width: `${proteinPct}%` }} />
            </div>
            <p className="tabular mt-2 text-[12px] text-text-muted">
              탄 {carb}g · 지 {fat}g
            </p>
          </Card>
        </Link>

        {/* 물 · 영양제 */}
        <Link to="/record/daily" className="group">
          <Card className="h-full transition-colors group-hover:bg-surface-muted/40">
            <CardHeader className="mb-1">
              <CardTitle className="flex items-center gap-2 font-medium text-text-muted">
                <AppIcon icon={GlassWater} size="sm" /> 물 · 영양제
              </CardTitle>
            </CardHeader>
            <p className="tabular text-[32px] leading-tight font-bold tracking-tight">
              {todayCheck.waterCups}
              <span className="ml-1 text-base font-semibold text-text-muted">/ {todayCheck.waterGoalCups}컵</span>
            </p>
            <div className="mt-2.5 flex gap-1" aria-hidden>
              {Array.from({ length: todayCheck.waterGoalCups }).map((_, i) => (
                <span key={i} className={cn('h-2 flex-1 rounded-full', i < todayCheck.waterCups ? 'bg-icon' : 'bg-surface-muted')} />
              ))}
            </div>
            <div className="mt-3">
              {todayCheck.supplementTaken ? (
                <Badge tone="success">
                  <Pill size={13} strokeWidth={1.75} aria-hidden /> 영양제 복용 완료
                </Badge>
              ) : (
                <Badge>영양제 미기록</Badge>
              )}
            </div>
          </Card>
        </Link>

        {/* 투약 */}
        <Link to="/record/medication" className="group">
          <Card className="h-full transition-colors group-hover:bg-surface-muted/40">
            <CardHeader className="mb-1">
              <CardTitle className="flex items-center gap-2 font-medium text-text-muted">
                <AppIcon icon={Syringe} size="sm" /> 최근 투약
              </CardTitle>
            </CardHeader>
            {lastDose ? (
              <>
                <p className="text-[20px] leading-snug font-bold">
                  {MEDICATIONS[lastDose.medicationId].name} {lastDose.doseMg}mg
                </p>
                <p className="tabular mt-0.5 text-[13px] text-text-muted">
                  {formatShortDateWithDay(new Date(lastDose.administeredAt))} {formatTime(new Date(lastDose.administeredAt))} ·{' '}
                  {siteLabel(lastDose.site)}
                </p>
                {nextDue && (
                  <div className="mt-3 flex items-center gap-2 rounded-xl bg-surface-muted px-3 py-2">
                    <AppIcon icon={CalendarClock} size="sm" className="size-[18px]" />
                    <p className="text-[13px]">
                      다음 예정 <b className="tabular">{formatShortDateWithDay(nextDue)}</b>
                      {nextIn !== null && nextIn >= 0 && (
                        <span className="text-text-muted"> · {nextIn === 0 ? '오늘' : nextIn === 1 ? '내일' : `${nextIn}일 후`}</span>
                      )}
                    </p>
                  </div>
                )}
                <p className="mt-1.5 text-[11px] text-text-subtle">마지막 기록 +7일 기준 (사용자 기록 기준)</p>
              </>
            ) : (
              <p className="text-[14px] text-text-muted">아직 투약 기록이 없어요.</p>
            )}
          </Card>
        </Link>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {/* 컨디션 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AppIcon icon={Activity} size="sm" /> 최근 컨디션
            </CardTitle>
            <Link to="/record/symptom" className="text-[13px] font-medium text-text-muted hover:text-text">
              기록하기
            </Link>
          </CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex gap-1" aria-label={`컨디션 ${todayCheck.condition}/5`}>
              {[1, 2, 3, 4, 5].map((n) => (
                <span key={n} className={cn('h-6 w-3 rounded-full', n <= todayCheck.condition ? 'bg-primary' : 'bg-surface-muted')} />
              ))}
            </div>
            <p className="text-[15px] font-semibold">오늘 {CONDITION_LABEL[todayCheck.condition]}</p>
          </div>
          <div className="mt-4 flex flex-wrap gap-1.5">
            {recentSymptoms.map((s) => (
              <Badge key={s.id}>
                {SYMPTOM_LABEL[s.type]} · {formatShortDateWithDay(new Date(s.recordedAt))}
              </Badge>
            ))}
          </div>
        </Card>

        {/* 주간 기록 현황 */}
        <Card>
          <CardHeader>
            <CardTitle className="whitespace-nowrap">이번 주 기록 현황</CardTitle>
            <span className="truncate text-[12px] text-text-subtle">하루 5개 항목 기준</span>
          </CardHeader>
          <ol className="grid grid-cols-7 gap-1.5">
            {weeklyStatus.map((d, i) => {
              const date = new Date(d.date + 'T00:00:00')
              const full = d.recorded === d.total
              return (
                <li key={d.date} className="flex min-w-0 flex-col items-center gap-1.5">
                  <span
                    className={cn(
                      'tabular flex aspect-square w-full max-w-9 items-center justify-center rounded-full text-[12px] font-semibold',
                      full ? 'bg-primary text-primary-foreground' : 'bg-primary-soft text-primary',
                    )}
                    aria-label={`${formatShortDateWithDay(date)} ${d.recorded}/${d.total}개 기록`}
                  >
                    {d.recorded}
                  </span>
                  <span className={cn('text-[11px]', i === weeklyStatus.length - 1 ? 'font-bold text-text' : 'text-text-subtle')}>
                    {'일월화수목금토'[date.getDay()]}
                  </span>
                </li>
              )
            })}
          </ol>
        </Card>
      </div>

      {/* 통합 타임라인 미리보기 */}
      <Card>
        <CardHeader>
          <CardTitle>최근 7일 통합 타임라인</CardTitle>
          <Link to="/analysis/timeline" className="inline-flex items-center text-[13px] font-medium text-text-muted hover:text-text">
            전체 보기 <ChevronRight size={16} strokeWidth={1.75} aria-hidden />
          </Link>
        </CardHeader>
        <HomeTimeline days={timeline} />
        <Notice tone="review" className="mt-4">
          {TIMELINE_DISCLAIMER}
        </Notice>
      </Card>
    </div>
  )
}
