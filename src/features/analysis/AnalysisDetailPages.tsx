import { Activity, Droplets, Printer, Scale, Syringe, Utensils } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'

import { BodyCompositionChart } from '@/components/charts/BodyCompositionChart'
import { WeightChart } from '@/components/charts/WeightChart'
import { AppIcon } from '@/components/common/AppIcon'
import { MockBadge } from '@/components/common/MockBadge'
import { PageHeader } from '@/components/common/PageHeader'
import { PeriodFilter, type Period } from '@/components/common/PeriodFilter'
import { EmptyState } from '@/components/common/StateViews'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { MEDICATIONS, siteLabel } from '@/fixtures/medications.mock'
import { SYMPTOM_LABEL } from '@/fixtures/records.mock'
import { formatShortDateWithDay } from '@/lib/date'
import { isLive } from '@/lib/supabase'
import { useBodyLogs } from '@/services/body'
import { useDoses } from '@/services/doses'
import { useMyProfile } from '@/services/profile'
import { isNewUser } from '@/services/session'
import { useSymptoms } from '@/services/symptoms'
import { useIntakeStore } from '@/stores/intakeStore'
import { useMealStore } from '@/stores/mealStore'
import { useRecordsStore } from '@/stores/recordsStore'
import type { SymptomType } from '@/types/domain'

import { buildDays, hasAny, summarize, type Sources } from './analysisData'

function useSources(): Sources {
  return {
    doses: useDoses(),
    bodyLogs: useBodyLogs(),
    meals: useMealStore((s) => s.records),
    symptoms: useSymptoms(),
    daily: useRecordsStore((s) => s.daily),
    water: useIntakeStore((s) => s.water),
  }
}

const example = () => !isLive && !isNewUser()
const dayLabel = (k: string) => formatShortDateWithDay(new Date(`${k}T12:00:00`))

function Header({ title, description, period, setPeriod, actions }: { title: string; description: string; period?: Period; setPeriod?: (p: Period) => void; actions?: React.ReactNode }) {
  return (
    <>
      <PageHeader title={title} description={description} back="/analysis" actions={actions} />
      {(setPeriod || example()) && (
        <div className="mb-4 flex items-center justify-between gap-3 print:hidden">
          {setPeriod && period ? <PeriodFilter value={period} onChange={setPeriod} /> : <span />}
          {example() && <MockBadge />}
        </div>
      )}
    </>
  )
}

/** /analysis/timeline — 날짜별로 모든 기록을 한 줄에 */
export function TimelinePage() {
  const [period, setPeriod] = useState<Period>(30)
  const src = useSources()
  const rows = buildDays(src, period).filter(hasAny).reverse()
  return (
    <>
      <Header title="통합 타임라인" description="투약·체중·식단·증상을 같은 날짜로 모아 봐요." period={period} setPeriod={setPeriod} />
      {rows.length === 0 ? (
        <EmptyState title="이 기간에 기록이 없어요" description="기록을 남기면 날짜별로 여기에 모여요." action={<Button asChild><Link to="/record">기록하러 가기</Link></Button>} />
      ) : (
        <ol className="space-y-2.5 md:max-w-2xl" aria-label="날짜별 기록">
          {rows.map((r) => (
            <li key={r.date}>
              <Card className="p-4">
                <p className="text-[14px] font-bold">{dayLabel(r.date)}</p>
                <ul className="mt-2 flex flex-wrap gap-1.5 text-[13px]">
                  {r.doses.map((d) => (
                    <li key={d.id} className="inline-flex items-center gap-1 rounded-full bg-icon-soft px-2.5 py-1 text-icon">
                      <Syringe size={13} strokeWidth={1.75} aria-hidden /> {MEDICATIONS[d.medicationId]?.name ?? d.medicationId} {d.doseMg}mg
                    </li>
                  ))}
                  {r.weightKg !== null && (
                    <li className="inline-flex items-center gap-1 rounded-full bg-surface-muted px-2.5 py-1">
                      <Scale size={13} strokeWidth={1.75} aria-hidden /> {r.weightKg.toFixed(1)}kg
                    </li>
                  )}
                  {r.meals > 0 && (
                    <li className="inline-flex items-center gap-1 rounded-full bg-surface-muted px-2.5 py-1">
                      <Utensils size={13} strokeWidth={1.75} aria-hidden /> {r.meals}끼 · {r.kcal?.toLocaleString()}kcal
                    </li>
                  )}
                  {r.symptoms.map((s) => (
                    <li key={s.id} className="inline-flex items-center gap-1 rounded-full bg-review-soft px-2.5 py-1 text-review">
                      <Activity size={13} strokeWidth={1.75} aria-hidden /> {SYMPTOM_LABEL[s.type as SymptomType] ?? s.type} {s.severity}
                    </li>
                  ))}
                  {r.condition !== null && <li className="rounded-full bg-surface-muted px-2.5 py-1">컨디션 {r.condition}/5</li>}
                  {r.waterMl > 0 && (
                    <li className="inline-flex items-center gap-1 rounded-full bg-surface-muted px-2.5 py-1">
                      <Droplets size={13} strokeWidth={1.75} aria-hidden /> 물 {r.waterMl.toLocaleString()}mL
                    </li>
                  )}
                </ul>
              </Card>
            </li>
          ))}
          <p className="pt-1 text-[12px] text-text-subtle">같은 날 나란히 보여줄 뿐, 증상과 약의 관계를 판단하지 않아요.</p>
        </ol>
      )}
    </>
  )
}

/** /analysis/body — 체중·체성분 변화 */
export function BodyChangePage() {
  const [period, setPeriod] = useState<Period>(90)
  const logs = useBodyLogs()
  const { startWeightKg, goalWeightKg } = useMyProfile()
  const [now] = useState(() => Date.now())
  const from = now - period * 86_400_000
  const inRange = logs.filter((l) => new Date(l.measuredAt).getTime() >= from)
  const comp = inRange.filter((l) => l.skeletalMuscleKg !== undefined || l.bodyFatKg !== undefined || l.bodyFatPct !== undefined)
  const first = inRange[0]
  const last = inRange.at(-1)
  return (
    <>
      <Header title="바디 변화" description="체중과 체성분이 어떻게 바뀌었는지 봐요." period={period} setPeriod={setPeriod} />
      <div className="space-y-4 md:max-w-2xl">
        {inRange.length === 0 ? (
          <EmptyState icon={Scale} title="이 기간에 체중 기록이 없어요" action={<Button asChild><Link to="/record/body/new">체중 기록하기</Link></Button>} />
        ) : (
          <>
            <Card>
              <dl className="grid grid-cols-3 gap-2 text-center">
                {[
                  ['기간 첫 기록', first ? `${first.weightKg.toFixed(1)}kg` : '-'],
                  ['최근', last ? `${last.weightKg.toFixed(1)}kg` : '-'],
                  ['변화', first && last && inRange.length > 1 ? `${last.weightKg - first.weightKg > 0 ? '+' : ''}${(last.weightKg - first.weightKg).toFixed(1)}kg` : '-'],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-2xl bg-surface-muted px-2 py-3">
                    <dt className="text-[12px] text-text-muted">{k}</dt>
                    <dd className="tabular mt-0.5 text-[18px] font-bold">{v}</dd>
                  </div>
                ))}
              </dl>
              {inRange.length > 1 ? <div className="mt-4"><WeightChart logs={inRange} height={220} /></div> : <p className="mt-3 text-[13px] text-text-subtle">기록이 2개 이상이면 그래프가 보여요.</p>}
              <p className="mt-2 text-[12px] text-text-subtle">
                {startWeightKg !== null && `시작 ${startWeightKg}kg`} {goalWeightKg !== null && `· 목표 ${goalWeightKg}kg (내가 정한 값)`}
              </p>
            </Card>
            <Card>
              <h2 className="mb-2 text-[16px] font-bold">체성분</h2>
              {comp.length === 0 ? (
                <p className="text-[13px] text-text-muted">체성분(골격근량·체지방) 기록이 없어요. 인바디 결과지 값을 체중 기록에 함께 입력하면 여기에 보여요.</p>
              ) : (
                <BodyCompositionChart logs={comp} height={240} />
              )}
            </Card>
            <Link to="/record/eyebody" className="block text-center text-[13px] font-medium text-primary">눈바디 사진(이 기기에만 저장) 보기</Link>
          </>
        )}
      </div>
    </>
  )
}


/** /analysis/consult — 진료·상담 때 보여줄 기록 요약 (인쇄·PDF 저장) */
export function ConsultPage() {
  const [period, setPeriod] = useState<Period>(30)
  const src = useSources()
  const rows = buildDays(src, period)
  const s = summarize(rows, src)
  const { nickname } = useMyProfile()
  return (
    <>
      <Header
        title="상담 준비"
        description="진료·상담 때 보여줄 기록 요약이에요."
        period={period}
        setPeriod={setPeriod}
        actions={
          <Button variant="outline" size="sm" className="h-10 print:hidden" onClick={() => window.print()}>
            <Printer size={16} strokeWidth={1.75} aria-hidden /> 인쇄·PDF
          </Button>
        }
      />
      {s.recordedDays === 0 ? (
        <EmptyState title="이 기간에 기록이 없어요" />
      ) : (
        <div className="space-y-3 md:max-w-2xl print:max-w-none" aria-label="상담 준비 요약">
          <Card>
            <p className="text-[13px] text-text-muted">
              {nickname && `${nickname} · `}
              {dayLabel(s.from!)} ~ {dayLabel(s.to!)} · 기록한 날 {s.recordedDays}일
            </p>
          </Card>
          <Card>
            <h2 className="mb-2 flex items-center gap-2 text-[15px] font-bold"><AppIcon icon={Syringe} size="sm" /> 투약 {s.doses.length}회</h2>
            {s.doses.length === 0 ? <p className="text-[13px] text-text-muted">기록 없음</p> : (
              <ul className="space-y-1 text-[14px]">
                {s.doses.map((d) => (
                  <li key={d.id} className="tabular">
                    {formatShortDateWithDay(new Date(d.administeredAt))}{d.timeUnknown ? ' (시간 모름)' : ''} · {MEDICATIONS[d.medicationId]?.name} {d.doseMg}mg · {siteLabel(d.site)}
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card>
            <h2 className="mb-2 flex items-center gap-2 text-[15px] font-bold"><AppIcon icon={Scale} size="sm" /> 체중</h2>
            {s.weightFirst && s.weightLast ? (
              <p className="tabular text-[14px]">
                {s.weightFirst.weightKg.toFixed(1)}kg → {s.weightLast.weightKg.toFixed(1)}kg ({s.weightLast.weightKg - s.weightFirst.weightKg > 0 ? '+' : ''}{(s.weightLast.weightKg - s.weightFirst.weightKg).toFixed(1)}kg, 기록 {s.weightCount}회)
              </p>
            ) : <p className="text-[13px] text-text-muted">기록 없음</p>}
          </Card>
          <Card>
            <h2 className="mb-2 flex items-center gap-2 text-[15px] font-bold"><AppIcon icon={Activity} size="sm" /> 증상</h2>
            {s.symptoms.length === 0 ? <p className="text-[13px] text-text-muted">기록 없음</p> : (
              <ul className="flex flex-wrap gap-1.5">
                {s.symptoms.map((x) => (
                  <li key={x.type}><Badge tone="review">{SYMPTOM_LABEL[x.type as SymptomType] ?? x.type} {x.count}회 · 최고 강도 {x.maxSeverity}</Badge></li>
                ))}
              </ul>
            )}
            {s.avgCondition !== null && <p className="tabular mt-2 text-[14px]">평균 컨디션 {s.avgCondition.toFixed(1)}/5 ({s.conditionDays}일 기록)</p>}
          </Card>
          <Card>
            <h2 className="mb-2 flex items-center gap-2 text-[15px] font-bold"><AppIcon icon={Utensils} size="sm" /> 식단</h2>
            {s.avgKcal !== null ? <p className="tabular text-[14px]">기록한 {s.kcalDays}일 평균 {Math.round(s.avgKcal).toLocaleString()}kcal</p> : <p className="text-[13px] text-text-muted">기록 없음</p>}
          </Card>
          <p className="px-1 text-[12px] leading-relaxed text-text-subtle">사용자가 직접 기록한 내용을 모은 것이에요. 진단이나 용량 판단에 쓰는 자료가 아니며, 투약·증상의 관계를 판단하지 않아요.</p>
        </div>
      )}
    </>
  )
}
