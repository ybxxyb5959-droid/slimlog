import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { PageHeader } from '@/components/common/PageHeader'
import { EmptyState } from '@/components/common/StateViews'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { removeDose, savedNote, updateDose, useDose } from '@/services/doses'
import { dbErrorMessage } from '@/lib/supabase'

import { DoseForm } from './DoseForm'
import { draftFromDose } from './doseDraft'

export function MedicationDetailPage() {
  const { id } = useParams()
  const dose = useDose(id)
  const navigate = useNavigate()
  const [draft, setDraft] = useState(() => draftFromDose(dose))
  const [confirm, setConfirm] = useState(false)

  if (!dose)
    return (
      <EmptyState
        title="기록을 찾을 수 없어요"
        description="삭제되었거나 잘못된 주소예요."
        action={
          <Button asChild>
            <Link to="/record/medication">투약 기록으로</Link>
          </Button>
        }
      />
    )

  return (
    <>
      <PageHeader title="투약 기록 수정" back="/record/medication" />
      <Card className="md:max-w-[420px]">
        <DoseForm
          draft={draft}
          onChange={setDraft}
          submitLabel="수정 저장"
          onSubmit={async (value) => {
            try {
              await updateDose({ ...value, id: dose.id })
              toast.success('투약 기록을 수정했어요', { description: savedNote() })
              navigate('/record/medication')
            } catch (e) {
              toast.error('수정하지 못했어요', { description: dbErrorMessage(e) })
            }
          }}
          extraActions={
            <Button type="button" variant="ghost" className="w-full text-danger hover:bg-danger-soft hover:text-danger" onClick={() => setConfirm(true)}>
              기록 삭제
            </Button>
          }
        />
      </Card>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="이 투약 기록을 삭제할까요?"
        description="삭제하면 참고 곡선과 타임라인에서도 사라져요."
        confirmLabel="삭제"
        tone="danger"
        onConfirm={async () => {
          try {
            await removeDose(dose.id)
            toast('투약 기록을 삭제했어요', { description: savedNote() })
            navigate('/record/medication')
          } catch (e) {
            toast.error('삭제하지 못했어요', { description: dbErrorMessage(e) })
          }
        }}
      />
    </>
  )
}
