import { BarChart3, CalendarDays, Flame, Pencil, Utensils } from 'lucide-react'
import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { AXIS_TICK, ChartTooltipBox } from '@/components/charts/ChartTooltip'
import { MockBadge } from '@/components/common/MockBadge'
import { PageHeader } from '@/components/common/PageHeader'
import { PeriodFilter, type Period } from '@/components/common/PeriodFilter'
import { EmptyState } from '@/components/common/StateViews'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { formatShortDateWithDay, formatTime, toDateKey } from '@/lib/date'
import { sumNutrients } from '@/lib/nutrition'
import { isLive } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { isNewUser } from '@/services/session'
import { useIntakeStore } from '@/stores/intakeStore'
import { useMealDraftStore } from '@/stores/mealDraftStore'
import { useMealStore } from '@/stores/mealStore'
import type { MealRecord } from '@/types/meal'

import { buildDays, type DayRow } from './analysisData'

/**
 * /analysis/nutrition — 식단 · 영양 분석
 * ① 일평균 칼로리 ② 탄·단·지 일평균 ③ 영양소별 추이(탭) ④ 날짜별 상세(아침·점심·저녁·간식)
 * - 평균은 '기록한 날'만으로 계산한다. 기록 없는 날은 0이 아니라 '미기록' 점으로 보여 준다.
 * - 목표는 사용자가 직접 정한 단백질 목표만 쓴다 (앱이 칼로리·탄수화물·지방 목표를 추천하지 않음).
 */
type Key = 'kcal' | 'carbG' | 'proteinG' | 'fatG'
const NUTRIENTS: { key: Key; label: string; unit: string; color: string; kcalPerG?: number }[] = [
  { key: 'kcal', label: '칼로리', unit: 'kcal', color: 'var(--primary)' },
  { key: 'carbG', label: '탄수화물', unit: 'g', color: 'var(--nutri-carb)', kcalPerG: 4 },
  { key: 'proteinG', label: '단백질', unit: 'g', color: 'var(--nutri-protein)', kcalPerG: 4 },
  { key: 'fatG', label: '지방', unit: 'g', color: 'var(--nutri-fat)', kcalPerG: 9 },
]
const MACROS = NUTRIENTS.filter((n) => n.kcalPerG)
const MEAL_ORDER = ['breakfast', 'lunch', 'dinner', 'snack'] as const
const MEAL_LABEL = { breakfast: '아침', lunch: '점심', dinner: '저녁', snack: '간식' } as const

const round1 = (n: number) => Math.round(n * 10) / 10
const avgOf = (rows: DayRow[], k: Key) => (rows.length ? rows.reduce((a, r) => a + (r[k] ?? 0), 0) / rows.length : null)
const dayLabel = (k: string) => formatShortDateWithDay(new Date(`${k}T12:00:00`))

export function NutritionPage() {
  const [period, setPeriod] = useState<Period>(7)
  const meals = useMealStore((s) => s.records)
  const proteinGoal = useIntakeStore((s) => s.proteinGoalG)
  const rows = buildDays({ meals, doses: [], bodyLogs: [], symptoms: [], daily: [], water: [] }, period)
  const recorded = rows.filter((r) => r.kcal !== null)
  const [tab, setTab] = useState<Key>('kcal')
  const [pickedDate, setPickedDate] = useState<string | null>(null)
  const detailRef = useRef<HTMLElement>(null)
  const dateInputRef = useRef<HTMLInputElement>(null)
  const example = !isLive && !isNewUser()

  const avgKcal = avgOf(recorded, 'kcal')
  const latest = recorded.at(-1)?.date ?? null
  const date = pickedDate && rows.some((r) => r.date === pickedDate) ? pickedDate : latest

  const openCalendar = () => {
    detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    const el = dateInputRef.current
    if (!el) return
    el.focus({ preventScroll: true })
    try {
      el.showPicker?.()
    } catch {
      /* 일부 브라우저는 사용자 동작 안에서만 열림 — 포커스로 대신 */
    }
  }

  return (
    <>
      <PageHeader
        title="식단 · 영양 분석"
        description="나의 영양 섭취를 한눈에 확인해요"
        back="/analysis"
        actions={
          recorded.length > 0 ? (
            <Button variant="ghost" size="icon" aria-label="날짜별 상세 보기" onClick={openCalendar}>
              <CalendarDays size={20} strokeWidth={1.75} aria-hidden />
            </Button>
          ) : undefined
        }
      />
      <div className="mb-4 flex items-center justify-between gap-3">
        <PeriodFilter value={period} onChange={setPeriod} />
        {example && <MockBadge />}
      </div>

      {recorded.length === 0 ? (
        <EmptyState icon={Utensils} title="이 기간에 식단 기록이 없어요" action={<Button asChild><Link to="/record/meal/new">식단 기록하기</Link></Button>} />
      ) : (
        <div className="space-y-4 md:max-w-2xl">
          {/* ① 칼로리 요약 + ② 영양소별 일평균 */}
          <Card className="space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[13px] text-text-muted">일평균 섭취 칼로리</p>
                <p className="mt-1">
                  <span className="tabular text-[34px] leading-none font-bold">{Math.round(avgKcal!).toLocaleString()}</span>
                  <span className="ml-1 text-[14px] font-semibold text-text-muted">kcal</span>
                </p>
                <p className="mt-1.5 text-[12px] text-text-muted">
                  기록한 날 기준 평균 · <span className="tabular">{recorded.length}/{period === 90 ? '90' : period}일</span> 기록
                </p>
              </div>
              <div className="flex size-16 shrink-0 flex-col items-center justify-center gap-0.5 rounded-2xl bg-surface-muted" aria-hidden>
                <Flame size={20} strokeWidth={1.75} className="text-primary" />
                <span className="text-[11px] font-semibold">칼로리</span>
              </div>
            </div>

            <div className="border-t border-border pt-4">
              <h2 className="text-[15px] font-semibold">영양소별 일평균 섭취량</h2>
              <ul className="mt-3 grid grid-cols-3 gap-2">
                {MACROS.map((m) => {
                  const g = avgOf(recorded, m.key)!
                  const share = avgKcal ? Math.round(((g * m.kcalPerG!) / avgKcal) * 100) : 0
                  const goalPct = m.key === 'proteinG' && proteinGoal ? Math.round((g / proteinGoal) * 100) : null
                  return (
                    <li key={m.key} className="rounded-2xl bg-surface-muted px-3 py-3">
                      <p className="flex items-center gap-1.5 text-[12px] font-semibold">
                        <span aria-hidden className="size-2 rounded-full" style={{ background: m.color }} />
                        {m.label}
                      </p>
                      <p className="tabular mt-1 text-[22px] leading-tight font-bold">
                        {round1(g)}
                        <span className="text-[13px] font-semibold text-text-muted">g</span>
                      </p>
                      <div
                        className="mt-2 h-1.5 overflow-hidden rounded-full bg-border"
                        role="meter"
                        aria-label={`${m.label} 열량 비율`}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={Math.min(share, 100)}
                      >
                        <div className="h-full rounded-full" style={{ width: `${Math.min(share, 100)}%`, background: m.color }} />
                      </div>
                      <p className="tabular mt-1.5 text-[11px] text-text-muted">열량 중 {share}%</p>
                      {goalPct !== null && <p className="tabular text-[11px] font-medium text-text">목표 대비 {goalPct}%</p>}
                    </li>
                  )
                })}
              </ul>
              <p className="mt-2 text-[12px] text-text-subtle">
                막대는 하루 열량 중 그 영양소가 차지하는 비율이에요.
                {proteinGoal ? '' : ' 단백질 목표는 설정에서 직접 정할 수 있어요.'}
              </p>
            </div>
          </Card>

          {/* ③ 영양소별 추이 */}
          <TrendCard rows={rows} tab={tab} setTab={setTab} proteinGoal={proteinGoal} onPickDay={(d) => setPickedDate(d)} />

          {/* ④ 날짜별 상세 */}
          <section ref={detailRef} aria-labelledby="day-detail" className="scroll-mt-4">
            <DayDetail
              meals={meals}
              rows={rows}
              date={date!}
              setDate={setPickedDate}
              inputRef={dateInputRef}
            />
          </section>
          <p className="text-[12px] text-text-subtle">기록하지 않은 날은 0이 아니라 '미기록'이에요. 평균은 기록한 날만으로 계산해요.</p>
        </div>
      )}
    </>
  )
}

function TrendCard({ rows, tab, setTab, proteinGoal, onPickDay }: { rows: DayRow[]; tab: Key; setTab: (k: Key) => void; proteinGoal: number | null; onPickDay: (d: string) => void }) {
  const n = NUTRIENTS.find((x) => x.key === tab)!
  const goal = tab === 'proteinG' ? proteinGoal : null
  const data = rows.map((r) => ({ date: r.date, label: r.date.slice(8), v: r[tab] === null ? 0 : round1(r[tab]!), empty: r[tab] === null, incomplete: r.nutritionIncomplete }))
  const recorded = data.filter((d) => !d.empty)
  const goalDays = goal ? recorded.filter((d) => d.v >= goal).length : 0
  return (
    <Card>
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-[15px] font-semibold">
          <BarChart3 size={16} strokeWidth={1.75} aria-hidden className="text-icon" />
          영양소별 섭취 추이
        </h2>
        <span className="text-[12px] text-text-muted">최근 {rows.length}일</span>
      </div>
      <div role="tablist" aria-label="영양소" className="mt-3 grid grid-cols-4 gap-1.5">
        {NUTRIENTS.map((x) => (
          <button
            key={x.key}
            type="button"
            role="tab"
            aria-selected={tab === x.key}
            onClick={() => setTab(x.key)}
            className={cn('h-9 rounded-full border text-[13px] font-medium transition-colors', tab === x.key ? 'border-text bg-text font-semibold text-surface' : 'border-border text-text-muted hover:bg-surface-muted')}
          >
            {x.label}
          </button>
        ))}
      </div>
      <div className="mt-3 flex items-baseline justify-between text-[12px] text-text-muted">
        <span>
          {n.label} ({n.unit})
        </span>
        {goal ? (
          <span className="tabular">
            목표 {goal}g 넘긴 날 <b className="text-text">{goalDays}일</b> / 기록한 {recorded.length}일
          </span>
        ) : tab === 'proteinG' ? (
          <Link to="/my/settings/app" className="font-medium text-primary underline-offset-2 hover:underline">
            목표 정하기
          </Link>
        ) : null}
      </div>
      <div className="mt-2 h-[220px]" role="img" aria-label={`날짜별 ${n.label} 막대 그래프${goal ? `, 목표 ${goal}g 점선` : ''}`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }} onClick={(s) => {
            const p = (s as { activePayload?: { payload: { date: string; empty: boolean } }[] } | null)?.activePayload?.[0]?.payload
            if (p && !p.empty) onPickDay(p.date)
          }}>
            <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
            <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={false} interval="preserveStartEnd" />
            <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={44} domain={[0, (max: number) => Math.ceil((Math.max(max, goal ?? 0, 1) * 1.1) / 10) * 10]} />
            <Tooltip
              cursor={{ fill: 'var(--surface-muted)' }}
              content={({ active, payload }) =>
                active && payload?.[0] ? (
                  <ChartTooltipBox
                    title={dayLabel(String(payload[0].payload.date))}
                    rows={payload[0].payload.empty ? [{ label: '기록', value: '없음' }] : [{ label: n.label, value: `${payload[0].payload.v.toLocaleString()}${n.unit}` }]}
                  />
                ) : null
              }
            />
            <Bar dataKey="v" fill={n.color} radius={[6, 6, 0, 0]} maxBarSize={36} shape={EmptyDotBar} isAnimationActive={false} />
            {goal ? <ReferenceLine y={goal} stroke="var(--text-muted)" strokeDasharray="4 4" /> : null}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 text-[12px] text-text-subtle">
        회색 점 = 기록 없는 날 · 막대를 누르면 아래에 그날 식단이 보여요
        {tab !== 'kcal' && recorded.some((d) => d.incomplete) ? ' · 영양 정보가 없는 음식이 있는 날은 실제보다 적게 보일 수 있어요' : ''}
      </p>
    </Card>
  )
}

/** 기록 없는 날은 막대 대신 바닥에 작은 회색 점 */
function EmptyDotBar(props: unknown) {
  const { x, y, width, height, fill, payload } = props as { x: number; y: number; width: number; height: number; fill: string; payload: { empty: boolean } }
  if (payload.empty) return <circle cx={x + width / 2} cy={y + height} r={3.5} fill="var(--text-subtle)" />
  const r = Math.min(6, width / 2, height)
  return <path d={`M${x},${y + height} V${y + r} Q${x},${y} ${x + r},${y} H${x + width - r} Q${x + width},${y} ${x + width},${y + r} V${y + height} Z`} fill={fill} />
}

function DayDetail({ meals, rows, date, setDate, inputRef }: { meals: MealRecord[]; rows: DayRow[]; date: string; setDate: (d: string) => void; inputRef: React.RefObject<HTMLInputElement | null> }) {
  const navigate = useNavigate()
  const loadRecord = useMealDraftStore((s) => s.loadRecord)
  const day = meals.filter((m) => toDateKey(new Date(m.eatenAt)) === date).sort((a, b) => a.eatenAt.localeCompare(b.eatenAt))
  const total = day.length ? sumNutrients(day.flatMap((m) => m.items)) : null
  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="day-detail" className="flex items-center gap-1.5 text-[15px] font-semibold">
          <CalendarDays size={16} strokeWidth={1.75} aria-hidden className="text-icon" />
          날짜별 상세 분석
        </h2>
        <input
          ref={inputRef}
          type="date"
          aria-label="상세 볼 날짜"
          value={date}
          min={rows[0]?.date}
          max={rows.at(-1)?.date}
          onChange={(e) => e.target.value && setDate(e.target.value)}
          className="h-10 rounded-xl border border-border bg-surface px-3 text-[14px] text-text"
        />
      </div>
      <p className="-mt-2 text-[13px] text-text-muted">{dayLabel(date)}</p>

      {!total ? (
        <p className="rounded-2xl bg-surface-muted px-4 py-6 text-center text-[14px] text-text-muted">이날은 식단 기록이 없어요</p>
      ) : (
        <>
          <dl className="grid grid-cols-4 gap-1.5 text-center">
            {NUTRIENTS.map((n) => (
              <div key={n.key} className="rounded-2xl bg-surface-muted px-1 py-2.5">
                <dt className="text-[11px] text-text-muted">{n.label}</dt>
                <dd className="tabular text-[15px] font-bold">
                  {n.key === 'kcal' ? total.kcal.toLocaleString() : round1(total[n.key])}
                  <span className="text-[11px] font-medium text-text-muted">{n.unit}</span>
                </dd>
              </div>
            ))}
          </dl>
          <ul className="space-y-2" aria-label="끼니별 기록">
            {MEAL_ORDER.flatMap((t) => day.filter((m) => m.mealType === t)).map((m) => {
              const t = sumNutrients(m.items)
              return (
                <li key={m.id} className="rounded-2xl border border-border">
                  <div className="flex items-center gap-2 px-4 pt-3">
                    <span className="text-[14px] font-semibold">{MEAL_LABEL[m.mealType as keyof typeof MEAL_LABEL] ?? m.mealType}</span>
                    <span className="tabular text-[12px] text-text-muted">{formatTime(new Date(m.eatenAt))}</span>
                    <span className="tabular ml-auto text-[14px] font-semibold">{t.kcal.toLocaleString()}kcal</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-9"
                      aria-label={`${MEAL_LABEL[m.mealType as keyof typeof MEAL_LABEL] ?? ''} ${formatTime(new Date(m.eatenAt))} 기록 수정`}
                      onClick={() => {
                        loadRecord(m)
                        navigate('/record/meal/review')
                      }}
                    >
                      <Pencil size={15} strokeWidth={1.75} aria-hidden />
                    </Button>
                  </div>
                  <p className="truncate px-4 pb-1 text-[13px] text-text-muted">{m.items.map((i) => i.name).join(' · ')}</p>
                  <p className="tabular px-4 pb-3 text-[12px] text-text-subtle">
                    탄 {round1(t.carbG)}g · 단 {round1(t.proteinG)}g · 지 {round1(t.fatG)}g
                  </p>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </Card>
  )
}
