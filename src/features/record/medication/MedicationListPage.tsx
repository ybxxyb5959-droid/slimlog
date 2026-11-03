import { ChevronRight, Plus, Syringe } from 'lucide-react'
import { Link } from 'react-router'

import { AppIcon } from '@/components/common/AppIcon'
import { MockBadge } from '@/components/common/MockBadge'
import { PageHeader } from '@/components/common/PageHeader'
import { EmptyState } from '@/components/common/StateViews'
import { Button } from '@/components/ui/button'
import { MEDICATIONS, siteLabel } from '@/fixtures/medications.mock'
import { formatShortDateWithDay, formatTime } from '@/lib/date'
import { useDoses } from '@/services/doses'

export function MedicationListPage() {
  const doses = useDoses()
  return (
    <>
      <PageHeader
        title="투약 기록"
        back="/record"
        actions={
          <Button asChild size="sm" className="h-10">
            <Link to="/record/medication/new">
              <Plus size={18} strokeWidth={1.75} aria-hidden /> 새 기록
            </Link>
          </Button>
        }
      />
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[13px] text-text-muted">총 {doses.length}회</p>
        <MockBadge />
      </div>
      {doses.length === 0 ? (
        <EmptyState
          icon={Syringe}
          title="아직 투약 기록이 없어요"
          description="첫 투약을 기록하면 참고용 곡선과 타임라인에 표시돼요."
          action={
            <Button asChild>
              <Link to="/record/medication/new">투약 기록하기</Link>
            </Button>
          }
        />
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-card border border-border bg-surface md:max-w-2xl">
          {doses.map((d) => {
            const date = new Date(d.administeredAt)
            return (
              <li key={d.id}>
                <Link to={`/record/medication/${d.id}`} className="flex min-h-[68px] items-center gap-3.5 px-4 py-3 hover:bg-surface-muted/60">
                  <AppIcon icon={Syringe} bg="soft" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-semibold">
                      {MEDICATIONS[d.medicationId].name} {d.doseMg}mg
                    </p>
                    <p className="tabular truncate text-[13px] text-text-muted">
                      {formatShortDateWithDay(date)} {formatTime(date)} · {siteLabel(d.site)}
                    </p>
                  </div>
                  {d.id.startsWith('local-') && <span className="text-[12px] font-medium text-primary">방금 추가</span>}
                  <AppIcon icon={ChevronRight} size="sm" tone="muted" />
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}
