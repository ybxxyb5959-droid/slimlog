import { useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'

import { PageHeader } from '@/components/common/PageHeader'
import { Card } from '@/components/ui/card'
import { MEDICATIONS } from '@/fixtures/medications.mock'
import { saveDose, savedNote, useDoses, validateDose } from '@/services/doses'
import { dbErrorMessage } from '@/lib/supabase'
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
            onSubmit={async (value) => {
              try {
                await saveDose(value)
                toast.success('투약 기록을 저장했어요', { description: savedNote() })
                navigate('/record/medication')
              } catch (e) {
                toast.error('저장하지 못했어요', { description: dbErrorMessage(e) })
              }
            }}
          />
        </Card>
        <ResidualPreviewCard medication={med} doses={preview} />
      </div>
    </>
  )
}
