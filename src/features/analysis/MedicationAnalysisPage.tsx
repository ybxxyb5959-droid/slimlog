import { ChevronDown } from 'lucide-react'
import { useState } from 'react'

import { ChipGroup } from '@/components/common/ChipGroup'
import { PageHeader } from '@/components/common/PageHeader'
import { PeriodFilter, type Period } from '@/components/common/PeriodFilter'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { MEDICATION_LIST, MEDICATIONS, siteLabel } from '@/fixtures/medications.mock'
import { MOCK_SYMPTOMS, SYMPTOM_LABEL } from '@/fixtures/records.mock'
import { formatShortDate } from '@/lib/date'
import { cn } from '@/lib/utils'
import { useDoses } from '@/services/doses'
import type { MedicationId } from '@/types/domain'

import { ResidualPreviewCard } from '../record/medication/ResidualPreviewCard'

export function MedicationAnalysisPage() {
  const doses = useDoses()
  const [period, setPeriod] = useState<Period>(30)
  const [medId, setMedId] = useState<MedicationId>('mounjaro')
  const [showSymptoms, setShowSymptoms] = useState(true)
  const med = MEDICATIONS[medId]
  const symptomTimes = showSymptoms
    ? MOCK_SYMPTOMS.map((s) => ({ t: new Date(s.recordedAt).getTime(), label: SYMPTOM_LABEL[s.type] }))
    : []
  const recent = doses.filter((d) => d.medicationId === medId).slice(0, 4)

  return (
    <>
      <PageHeader title="참고용 잔존량" description="투약 기록으로 계산한 상대값 곡선이에요." back="/analysis" />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <ChipGroup
          label="약 선택"
          columns={3}
          className="sm:w-80"
          options={MEDICATION_LIST.map((m) => ({ value: m.id, label: m.name }))}
          value={medId}
          onChange={setMedId}
        />
        <PeriodFilter value={period} onChange={setPeriod} />
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-3">
          <ResidualPreviewCard medication={med} doses={doses} days={period} symptomTimes={symptomTimes} height={280} />
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

          <Card className="p-0">
            <details className="group">
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between px-5 text-[15px] font-semibold">
                계산 방식 안내
                <ChevronDown size={20} strokeWidth={1.75} className="text-text-muted transition-transform group-open:rotate-180" aria-hidden />
              </summary>
              <div className="space-y-2 px-5 pb-5 text-[13px] leading-relaxed text-text-muted">
                <p>각 투약 기록의 용량 × (1/2)^(경과 시간 ÷ 반감기)를 모두 더한 뒤, 표시 기간의 최댓값을 100으로 둔 상대값으로 보여줘요.</p>
                <p>반감기는 제품 허가사항 출처와 함께 저장하며, 출처가 없는 약은 곡선을 만들지 않아요.</p>
                <p>흡수 속도, 체중, 개인차는 반영하지 않아요. 진단이나 용량 결정에 쓰지 마세요.</p>
                <p className="text-text-subtle">현재 화면의 곡선은 예시 데이터로 그린 것이며, 실제 계산은 서버 연결 후 제공돼요.</p>
              </div>
            </details>
          </Card>
        </div>
      </div>
    </>
  )
}
