import { ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'

import { ANALYSIS_MENUS } from '@/app/navigation'
import { WeightChart } from '@/components/charts/WeightChart'
import { MenuTile } from '@/components/common/MenuTile'
import { MockBadge } from '@/components/common/MockBadge'
import { PageHeader } from '@/components/common/PageHeader'
import { PeriodFilter, type Period } from '@/components/common/PeriodFilter'
import { LoadingState } from '@/components/common/StateViews'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { MEDICATIONS } from '@/fixtures/medications.mock'
import { MOCK_PROFILE } from '@/fixtures/records.mock'
import { addDays } from '@/lib/date'
import { useAsync } from '@/lib/useAsync'
import { useDoses } from '@/services/doses'
import { getBodyLogs } from '@/services/records'

import { ResidualPreviewCard } from '../record/medication/ResidualPreviewCard'
import { AnalysisNoticeButton } from './AnalysisSection'

export function AnalysisHubPage() {
  const [period, setPeriod] = useState<Period>(30)
  const { data: logs, loading } = useAsync(getBodyLogs)
  const doses = useDoses()
  const from = addDays(new Date(), -period).getTime()
  const inRange = logs?.filter((l) => new Date(l.measuredAt).getTime() >= from) ?? []
  const first = inRange[0]
  const last = inRange.at(-1)
  const diff = first && last ? last.weightKg - first.weightKg : null

  return (
    <>
      <PageHeader title="분석" description="기록을 같은 날짜축에서 비교해 보세요." actions={<AnalysisNoticeButton />} />
      <div className="mb-4 flex items-center justify-between gap-3">
        <PeriodFilter value={period} onChange={setPeriod} />
        <MockBadge />
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Card className="min-w-0">
          <CardHeader>
            <div>
              <CardTitle className="text-[17px] font-bold">체중 변화</CardTitle>
              {diff !== null && (
                <p className="tabular mt-0.5 text-[13px] text-text-muted">
                  이 기간 <b className="text-primary">{diff > 0 ? '+' : ''}{diff.toFixed(1)}kg</b> · 시작 {MOCK_PROFILE.startWeightKg}kg
                </p>
              )}
            </div>
            <Link to="/analysis/body" className="inline-flex shrink-0 items-center text-[13px] font-medium text-text-muted hover:text-text">
              바디 변화 <ChevronRight size={16} strokeWidth={1.75} aria-hidden />
            </Link>
          </CardHeader>
          {loading ? <LoadingState className="h-[240px] py-0" /> : <WeightChart logs={inRange} height={240} />}
        </Card>

        <div className="min-w-0">
          <ResidualPreviewCard medication={MEDICATIONS.mounjaro} doses={doses} height={200} />
          <Link
            to="/analysis/medication"
            className="mt-2 flex h-11 items-center justify-center gap-1 text-[13px] font-medium text-text-muted hover:text-text"
          >
            약 바꿔 보기 · 증상 겹쳐 보기 <ChevronRight size={16} strokeWidth={1.75} aria-hidden />
          </Link>
        </div>
      </div>

      <h2 className="mt-7 mb-3 text-[17px] font-bold">자세히 보기</h2>
      <ul className="grid gap-2.5 md:grid-cols-2">
        {ANALYSIS_MENUS.map((m) => (
          <li key={m.to}>
            <MenuTile to={m.to} icon={m.icon} title={m.label} description={m.description} />
          </li>
        ))}
      </ul>
    </>
  )
}
