import { useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'

import { PageHeader } from '@/components/common/PageHeader'
import { Card } from '@/components/ui/card'
import { MEDICATIONS } from '@/fixtures/medications.mock'
import { saveDoseMock, useDoses, validateDose } from '@/services/doses'
import type { Dose } from '@/types/domain'

import { DoseForm } from './DoseForm'
import { draftFromDose, draftToInput } from './doseDraft'
import { ResidualPreviewCard } from './ResidualPreviewCard'

export function MedicationNewPage() {
  const navigate = useNavigate()
  const doses = useDoses()
  const last = doses[0]
  const [draft, setDraft] = useState(() => draftFromDose(undefined, last?.medicationId))

  // 입력이 유효하면 미리보기 곡선에 "저장 전" 투약을 더해 보여준다
  const input = draftToInput(draft)
  const preview: Dose[] = validateDose(input) ? doses : [...doses, { ...(input as Dose), id: 'preview' }]
  const med = MEDICATIONS[draft.medicationId ?? 'mounjaro']

  return (
    <>
      <PageHeader title="투약 기록하기" back="/record/medication" />
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <Card>
          <DoseForm
            draft={draft}
            onChange={setDraft}
            lastSite={last?.site}
            submitLabel="저장"
            onSubmit={(value) => {
              saveDoseMock(value)
              toast.success('목업: 화면에만 저장됐어요', { description: '새로고침하면 사라지며 서버에 저장되지 않아요.' })
              navigate('/record/medication')
            }}
          />
        </Card>
        <ResidualPreviewCard medication={med} doses={preview} />
      </div>
    </>
  )
}
