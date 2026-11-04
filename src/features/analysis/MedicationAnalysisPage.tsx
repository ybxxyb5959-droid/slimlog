import { PageHeader } from '@/components/common/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { MEDICATIONS, siteLabel } from '@/fixtures/medications.mock'
import { formatShortDate } from '@/lib/date'
import { useDoses } from '@/services/doses'
import { useMyProfile } from '@/services/profile'
import type { MedicationId } from '@/types/domain'

import { ResidualPreviewCard } from '../record/medication/ResidualPreviewCard'
import { AnalysisNoticeButton } from './AnalysisSection'

export function MedicationAnalysisPage() {
  const doses = useDoses()
  const profile = useMyProfile()
  // 내가 쓰는 약: 프로필에 정한 약 → 없으면 가장 최근 투약한 약 (약 바꿔 보기 버튼은 두지 않음)
  const medId: MedicationId = profile.medicationId ?? doses[0]?.medicationId ?? 'mounjaro'
  const med = MEDICATIONS[medId]
  const recent = doses.filter((d) => d.medicationId === medId).slice(0, 4)

  return (
    <>
      <PageHeader title="참고용 잔존량" description={`${med.name} 투약 기록으로 계산한 상대값 곡선이에요.`} back="/analysis" actions={<AnalysisNoticeButton />} />

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-3">
          <ResidualPreviewCard key={med.id} medication={med} doses={doses} height={260} />
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
