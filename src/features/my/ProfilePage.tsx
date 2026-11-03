import { useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'

import { ChipGroup } from '@/components/common/ChipGroup'
import { PageHeader } from '@/components/common/PageHeader'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MEDICATION_LIST } from '@/fixtures/medications.mock'
import { MOCK_PROFILE } from '@/fixtures/records.mock'
import type { MedicationId } from '@/types/domain'

export function ProfilePage() {
  const navigate = useNavigate()
  const [nickname, setNickname] = useState(MOCK_PROFILE.nickname)
  const [start, setStart] = useState(String(MOCK_PROFILE.startWeightKg))
  const [goal, setGoal] = useState(String(MOCK_PROFILE.goalWeightKg))
  const [med, setMed] = useState<MedicationId>(MOCK_PROFILE.medicationId)
  const nickError = nickname.trim().length < 2 ? '닉네임은 2자 이상이에요.' : null

  return (
    <>
      <PageHeader title="프로필" back="/my" />
      <Card className="space-y-5 md:max-w-lg">
        <div>
          <Label htmlFor="nickname">닉네임 (커뮤니티에 보여요)</Label>
          <Input id="nickname" value={nickname} maxLength={12} onChange={(e) => setNickname(e.target.value)} aria-invalid={!!nickError} />
          {nickError && <p className="mt-1.5 text-[13px] text-danger">{nickError}</p>}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="startWeight">시작 체중 (kg)</Label>
            <Input id="startWeight" type="number" inputMode="decimal" value={start} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="goalWeight">목표 체중 (kg)</Label>
            <Input id="goalWeight" type="number" inputMode="decimal" value={goal} onChange={(e) => setGoal(e.target.value)} />
          </div>
        </div>
        <fieldset>
          <Label asChild>
            <legend>사용 중인 약</legend>
          </Label>
          <ChipGroup label="사용 중인 약" columns={3} options={MEDICATION_LIST.map((m) => ({ value: m.id, label: m.name }))} value={med} onChange={setMed} />
        </fieldset>
        <Button
          size="lg"
          className="w-full"
          disabled={!!nickError}
          onClick={() => {
            toast.success('목업: 화면에만 저장됐어요')
            navigate('/my')
          }}
        >
          저장
        </Button>
      </Card>
    </>
  )
}
