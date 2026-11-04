import { ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'

import { ANALYSIS_MENUS } from '@/app/navigation'
import { WeightChart } from '@/components/charts/WeightChart'
import { MenuTile } from '@/components/common/MenuTile'
import { MockBadge } from '@/components/common/MockBadge'
import { PageHeader } from '@/components/common/PageHeader'
import { PeriodFilter, type Period } from '@/components/common/PeriodFilter'
import { EmptyState, ErrorState, LoadingState } from '@/components/common/StateViews'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { MEDICATIONS } from '@/fixtures/medications.mock'
import { addDays } from '@/lib/date'
import { useAsync } from '@/lib/useAsync'
import { cn } from '@/lib/utils'
import { useDoses } from '@/services/doses'
import { useMyProfile } from '@/services/profile'
import { getBodyLogs } from '@/services/records'
import { isNewUser } from '@/services/session'
import type { MedicationId } from '@/types/domain'

import { ResidualPreviewCard } from '../record/medication/ResidualPreviewCard'
import { AnalysisNoticeButton } from './AnalysisSection'
import { DoseConditionSummary } from './DoseConditionSummary'
import { InbodyTab } from './InbodyTab'

type Tab = 'dose' | 'weight' | 'inbody'
const TABS: { id: Tab; label: string }[] = [
  { id: 'dose', label: '체내 용량' },
  { id: 'weight', label: '체중 변화' },
  { id: 'inbody', label: '인바디 변화' },
]

export function AnalysisHubPage() {
  const [params, setParams] = useSearchParams()
  const tab = (TABS.find((t) => t.id === params.get('tab'))?.id ?? 'dose') as Tab
  const [period, setPeriod] = useState<Period>(30)
  const { data: logs, loading, error, reload } = useAsync(getBodyLogs)
  const doses = useDoses()
  const profile = useMyProfile()
  const myMed: MedicationId = profile.medicationId ?? doses[0]?.medicationId ?? 'mounjaro'
  const from = addDays(new Date(), -period).getTime()
  const inRange = logs?.filter((l) => new Date(l.measuredAt).getTime() >= from) ?? []
  const first = inRange[0]
  const last = inRange.at(-1)
  const diff = first && last ? last.weightKg - first.weightKg : null
  const example = !isNewUser()

  return (
    <>
      <PageHeader title="분석" description="기록을 같은 날짜축에서 비교해 보세요." actions={<AnalysisNoticeButton />} />

      {/* 같은 너비 3탭 세그먼트 — 주소(?tab=)에 남겨 뒤로 가기·새로고침에도 유지 */}
      <div role="tablist" aria-label="분석 종류" className="mb-5 grid grid-cols-3 gap-1 rounded-2xl bg-surface-muted p-1 md:max-w-xl">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`analysis-tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls="analysis-panel"
            onClick={() => setParams(t.id === 'dose' ? {} : { tab: t.id }, { replace: true })}
            className={cn(
              'h-11 min-w-0 truncate rounded-xl px-1 text-[14px] font-medium transition-colors',
              tab === t.id ? 'bg-surface font-semibold text-text shadow-[0_1px_2px_rgba(15,23,42,0.08)]' : 'text-text-muted',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div id="analysis-panel" role="tabpanel" aria-labelledby={`analysis-tab-${tab}`} className="md:max-w-3xl">
        {tab === 'dose' && (
          <div className="min-w-0">
            {/* 내가 쓰는 약: 프로필 → 없으면 가장 최근 투약한 약 */}
            <ResidualPreviewCard key={myMed} medication={MEDICATIONS[myMed]} doses={doses} height={220} />
            <DoseConditionSummary />
          </div>
        )}

        {tab === 'weight' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <PeriodFilter value={period} onChange={setPeriod} />
              {example && <MockBadge />}
            </div>
            <Card className="min-w-0">
              <CardHeader>
                <div>
                  <CardTitle className="text-[17px] font-bold">체중 변화</CardTitle>
                  {diff !== null && inRange.length > 1 && (
                    <p className="tabular mt-0.5 text-[13px] text-text-muted">
                      이 기간 <b className="text-primary">{diff > 0 ? '+' : ''}{diff.toFixed(1)}kg</b>
                    </p>
                  )}
                </div>
                <Link to="/analysis/body" className="inline-flex shrink-0 items-center text-[13px] font-medium text-text-muted hover:text-text">
                  바디 변화 <ChevronRight size={16} strokeWidth={1.75} aria-hidden />
                </Link>
              </CardHeader>
              {loading ? (
                <LoadingState className="h-[240px] py-0" />
              ) : error ? (
                <ErrorState description="잠시 후 다시 시도해 주세요." action={<Button onClick={reload}>다시 불러오기</Button>} />
              ) : inRange.length < 2 ? (
                <EmptyState title="체중 기록이 2회 이상 필요해요" description="두 번 이상 기록하면 변화 그래프를 보여드려요." className="py-8" />
              ) : (
                <WeightChart logs={inRange} height={240} />
              )}
            </Card>
          </div>
        )}

        {tab === 'inbody' &&
          (loading ? <LoadingState className="h-[240px]" /> : error ? <ErrorState action={<Button onClick={reload}>다시 불러오기</Button>} /> : <InbodyTab logs={logs ?? []} isExample={example} />)}
      </div>

      <h2 className="mt-8 mb-3 text-[17px] font-bold">자세히 보기</h2>
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
