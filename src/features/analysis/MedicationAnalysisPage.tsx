import { useState } from 'react'

import { ChipGroup } from '@/components/common/ChipGroup'
import { PageHeader } from '@/components/common/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { MEDICATION_LIST, MEDICATIONS, siteLabel } from '@/fixtures/medications.mock'
import { MOCK_SYMPTOMS } from '@/fixtures/records.mock'
import { formatShortDate } from '@/lib/date'
import { cn } from '@/lib/utils'
import { useDoses } from '@/services/doses'
import type { MedicationId } from '@/types/domain'

import { ResidualPreviewCard } from '../record/medication/ResidualPreviewCard'
import { AnalysisNoticeButton } from './AnalysisSection'

export function MedicationAnalysisPage() {
  const doses = useDoses()
  const [medId, setMedId] = useState<MedicationId>('mounjaro')
  const [showSymptoms, setShowSymptoms] = useState(true)
  const med = MEDICATIONS[medId]
  const symptomTimes = showSymptoms
    ? MOCK_SYMPTOMS.map((s) => new Date(s.recordedAt).getTime())
    : []
  const recent = doses.filter((d) => d.medicationId === medId).slice(0, 4)

  return (
    <>
      <PageHeader title="참고용 잔존량" description="투약 기록으로 계산한 상대값 곡선이에요." back="/analysis" actions={<AnalysisNoticeButton />} />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <ChipGroup
          label="약 선택"
          columns={3}
          className="sm:w-80"
          options={MEDICATION_LIST.map((m) => ({ value: m.id, label: m.name }))}
          value={medId}
          onChange={setMedId}
        />
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-3">
          <ResidualPreviewCard key={med.id} medication={med} doses={doses} symptomTimes={symptomTimes} height={260} />
          <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-card border border-border bg-surface px-4 py-3">
            <span>
              <span className="block text-[14px] font-semibold">증상 기록 겹쳐 보기</span>
              <span className="block text-[12px] text-text-muted">곡선 아래 회색 점 = 증상 기록 시점</span>
            </span>
            <input
              type="checkbox"
              checked={showSymptoms}
              onChange={(e) => setShowSymptoms(e.target.checked)}
              className="peer sr-only"
            />
            <span
              aria-hidden
              className={cn(
                'relative h-7 w-12 shrink-0 rounded-full transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-primary/40',
                showSymptoms ? 'bg-primary' : 'bg-border',
              )}
            >
              <span className={cn('absolute top-1 size-5 rounded-full bg-white transition-all', showSymptoms ? 'left-6' : 'left-1')} />
            </span>
          </label>
        </div>

        <div className="space-y-3">
          <Card>
            <h2 className="text-[15px] font-semibold">최근 투약</h2>
            {recent.length ? (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {recent.map((d) => (
                  <Badge key={d.id} className="tabular px-3 py-1 text-[13px]">
                    {formatShortDate(new Date(d.administeredAt))} {d.doseMg}mg {siteLabel(d.site)}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-[13px] text-text-muted">{med.name} 투약 기록이 없어요.</p>
            )}
          </Card>

        </div>
      </div>
    </>
  )
}
