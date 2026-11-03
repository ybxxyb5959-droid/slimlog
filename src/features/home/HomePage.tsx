import {
  Activity,
  ChevronRight,
  CircleCheck,
  CirclePlus,
  Droplets,
  HeartPulse,
  type LucideIcon,
  Scale,
  Syringe,
  Utensils,
} from 'lucide-react'
import { Link } from 'react-router'

import { AppIcon } from '@/components/common/AppIcon'
import { MockBadge } from '@/components/common/MockBadge'
import { ErrorState, LoadingState } from '@/components/common/StateViews'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { MEDICATIONS, siteLabel } from '@/fixtures/medications.mock'
import { SYMPTOM_LABEL } from '@/fixtures/records.mock'
import { addDays, daysBetween, formatShortDateWithDay, formatTime, greetingFor } from '@/lib/date'
import { useAsync } from '@/lib/useAsync'
import { useDoses } from '@/services/doses'
import { getHomeSummary } from '@/services/records'

import { WeightAnalogyCard } from './WeightAnalogyCard'

const MEAL_LABEL = { breakfast: '아침', lunch: '점심', dinner: '저녁', snack: '간식' } as const
const monthDay = (iso: string) => {
  const d = new Date(iso)
  return `${d.getMonth() + 1}월 ${d.getDate()}일`
}

interface TodayTile {
  to: string
  icon: LucideIcon
  title: string
  done: boolean
  /** 기록했으면 값, 아니면 할 일 */
  sub: string
}

function TodayTileCard({ tile }: { tile: TodayTile }) {
  return (
    <Link
      to={tile.to}
      className="flex min-h-[120px] flex-col rounded-card border border-border bg-surface p-4 transition-colors hover:bg-surface-muted/60"
      aria-label={`${tile.title}: ${tile.done ? '기록함' : '기록 전'}, ${tile.sub}`}
    >
      <div className="flex items-start justify-between">
        <AppIcon icon={tile.icon} size="md" />
        <AppIcon icon={tile.done ? CircleCheck : CirclePlus} size="sm" tone={tile.done ? 'success' : 'muted'} />
      </div>
      <p className="mt-auto pt-4 text-[16px] font-bold text-text">{tile.title}</p>
      <p className="mt-0.5 truncate text-[13px] text-text-muted">{tile.sub}</p>
    </Link>
  )
}

export function HomePage() {
  const { data, loading, error, reload } = useAsync(getHomeSummary)
  const doses = useDoses()
  const now = new Date()

  if (loading) return <LoadingState className="min-h-[60vh]" />
  if (error || !data)
    return <ErrorState description="잠시 후 다시 시도해 주세요." action={<Button onClick={reload}>다시 불러오기</Button>} />

  const { profile, bodyLogs, todayMeals, todayCheck, symptoms } = data
  const sortedLogs = [...bodyLogs].sort((a, b) => a.measuredAt.localeCompare(b.measuredAt))
  const latest = sortedLogs[sortedLogs.length - 1]
  const kcal = todayMeals.reduce((a, m) => a + m.kcal, 0)

  const lastDose = doses[0]
  const nextDue = lastDose ? addDays(new Date(lastDose.administeredAt), 7) : null
  const nextIn = nextDue ? daysBetween(now, nextDue) : null
  const dosedToday = !!lastDose && daysBetween(new Date(lastDose.administeredAt), now) === 0
  const conditionDone = false // 예시: 오늘 컨디션 미입력 상태

  const tiles: TodayTile[] = [
    {
      to: '/record/medication',
      icon: Syringe,
      title: '투약',
      done: dosedToday,
      sub: dosedToday ? '오늘 기록함' : nextDue ? `다음 예정 ${formatShortDateWithDay(nextDue)}` : '투약 기록하기',
    },
    {
      to: '/record/meal',
      icon: Utensils,
      title: '식단',
      done: todayMeals.length > 0,
      sub: todayMeals.length > 0 ? `${todayMeals.length}끼 · ${kcal.toLocaleString()}kcal` : '식사 기록하기',
    },
    {
      to: '/record/daily',
      icon: Droplets,
      title: '수분',
      done: todayCheck.waterCups >= todayCheck.waterGoalCups,
      sub: todayCheck.waterCups > 0 ? `${todayCheck.waterCups} / ${todayCheck.waterGoalCups}컵` : '섭취량 기록',
    },
    { to: '/record/symptom', icon: HeartPulse, title: '컨디션', done: conditionDone, sub: '오늘 상태 입력' },
  ]

  const lastMeal = [...todayMeals].sort((a, b) => b.eatenAt.localeCompare(a.eatenAt))[0]
  const lastSymptom = [...symptoms].sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))[0]
  const activity = [
    latest && { at: latest.measuredAt, icon: Scale, title: '체중 기록', sub: `${monthDay(latest.measuredAt)} · ${latest.weightKg}kg` },
    lastMeal && { at: lastMeal.eatenAt, icon: Utensils, title: '식단 기록', sub: `${monthDay(lastMeal.eatenAt)} · ${MEAL_LABEL[lastMeal.mealType]} ${lastMeal.foodName}` },
    lastSymptom && { at: lastSymptom.recordedAt, icon: Activity, title: '증상 기록', sub: `${monthDay(lastSymptom.recordedAt)} · ${SYMPTOM_LABEL[lastSymptom.type]}` },
    lastDose && { at: lastDose.administeredAt, icon: Syringe, title: '투약 기록', sub: `${monthDay(lastDose.administeredAt)} · ${MEDICATIONS[lastDose.medicationId].name} ${lastDose.doseMg}mg` },
  ]
    .filter((x): x is { at: string; icon: LucideIcon; title: string; sub: string } => !!x)
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 3)

  return (
    <div className="space-y-5">
      <header className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[13px] font-medium text-text-muted">
            {now.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
          </p>
          <h1 className="mt-1 text-[22px] leading-tight font-bold tracking-tight md:text-2xl">
            {profile.nickname}님, {greetingFor(now)}
          </h1>
        </div>
      </header>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        {/* 오늘의 기록 */}
        <section aria-labelledby="today-title">
          <div className="mb-3 flex items-center justify-between">
            <h2 id="today-title" className="text-[20px] font-bold tracking-tight">
              오늘의 기록
            </h2>
            <MockBadge label="예시 상태" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {tiles.map((t) => (
              <TodayTileCard key={t.title} tile={t} />
            ))}
          </div>
        </section>

        {/* 체중 변화 (비유) */}
        <section aria-label="체중 변화" className="lg:pt-[44px]">
          <WeightAnalogyCard startKg={profile.startWeightKg} latestKg={latest.weightKg} to="/analysis" />
        </section>
      </div>

      <div className="grid items-start gap-3 lg:grid-cols-2">
        {/* 최근 투약 */}
        <Link to="/record/medication" className="group block">
          <Card className="transition-colors group-hover:bg-surface-muted/40">
            <CardHeader>
              <CardTitle className="text-[16px] font-bold">최근 투약</CardTitle>
              <AppIcon icon={ChevronRight} size="sm" tone="muted" />
            </CardHeader>
            {lastDose ? (
              <>
                <div className="flex items-center gap-3.5">
                  <AppIcon icon={Syringe} size="lg" bg="soft" className="size-12" />
                  <div className="min-w-0">
                    <p className="text-[17px] font-bold">
                      {MEDICATIONS[lastDose.medicationId].name} {lastDose.doseMg}mg
                    </p>
                    <p className="tabular truncate text-[13px] text-text-muted">
                      {formatShortDateWithDay(new Date(lastDose.administeredAt))} {formatTime(new Date(lastDose.administeredAt))} ·{' '}
                      {siteLabel(lastDose.site)} · 예시 데이터
                    </p>
                  </div>
                </div>
                {nextDue && (
                  <p className="tabular mt-3 text-[14px]">
                    다음 예정 <b>{formatShortDateWithDay(nextDue)}</b>
                    {nextIn !== null && nextIn >= 0 && (
                      <span className="text-text-muted"> · {nextIn === 0 ? '오늘' : nextIn === 1 ? '내일' : `${nextIn}일 후`}</span>
                    )}
                  </p>
                )}
                <p className="mt-2 text-[12px] leading-relaxed text-text-subtle">
                  투약 간격은 기록을 기반으로 표시하며 용량 변경을 권유하지 않습니다.
                </p>
              </>
            ) : (
              <p className="text-[14px] text-text-muted">아직 투약 기록이 없어요.</p>
            )}
          </Card>
        </Link>

        {/* 최근 활동 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-[16px] font-bold">최근 활동</CardTitle>
            <Link to="/analysis/timeline" className="-my-2 inline-flex min-h-10 items-center text-[13px] font-semibold text-primary hover:text-primary-hover">
              전체 보기
            </Link>
          </CardHeader>
          <ul className="space-y-3.5">
            {activity.map((a) => (
              <li key={a.title} className="flex items-center gap-3">
                <AppIcon icon={a.icon} size="md" tone="muted" />
                <div className="min-w-0">
                  <p className="text-[15px] font-semibold">{a.title}</p>
                  <p className="tabular truncate text-[13px] text-text-muted">{a.sub}</p>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  )
}
