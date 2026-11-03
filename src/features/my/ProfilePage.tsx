import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { toast } from 'sonner'

import { ChipGroup } from '@/components/common/ChipGroup'
import { PageHeader } from '@/components/common/PageHeader'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MEDICATION_LIST } from '@/fixtures/medications.mock'
import { validateNickname } from '@/lib/nickname'
import { dbErrorMessage, isLive } from '@/lib/supabase'
import { NicknameTakenError, updateHealth, updateNickname } from '@/services/live/account'
import { useMyProfile } from '@/services/profile'
import { useAuthStore } from '@/stores/authStore'
import { useOnboardingStore } from '@/stores/onboardingStore'
import type { MedicationId } from '@/types/domain'

export function ProfilePage() {
  const navigate = useNavigate()
  const profile = useMyProfile()
  const [nickname, setNickname] = useState(profile.nickname)
  const [med, setMed] = useState<MedicationId | null>(profile.medicationId)
  const [saving, setSaving] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const nickError = validateNickname(nickname) ?? serverError
  const hasSensitive = !isLive || !!useAuthStore.getState().account?.consents.includes('sensitive')

  const save = async () => {
    if (!isLive) {
      toast.success('목업: 화면에만 저장됐어요')
      return navigate('/my')
    }
    const account = useAuthStore.getState().account
    if (!account) return
    setSaving(true)
    try {
      const name = nickname.trim()
      if (name !== account.nickname) await updateNickname(account.userId, name)
      if (med !== account.currentMedId && hasSensitive) await updateHealth(account.userId, { current_med_id: med })
      useAuthStore.setState({ account: { ...account, nickname: name, currentMedId: hasSensitive ? med : account.currentMedId } })
      useOnboardingStore.setState({ nickname: name })
      toast.success('프로필을 저장했어요')
      navigate('/my')
    } catch (e) {
      if (e instanceof NicknameTakenError) setServerError(e.message)
      else toast.error('저장하지 못했어요', { description: dbErrorMessage(e) })
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <PageHeader title="프로필" back="/my" />
      <Card className="space-y-5 md:max-w-lg">
        <div>
          <Label htmlFor="nickname">닉네임 (커뮤니티에 보여요)</Label>
          <Input
            id="nickname"
            value={nickname}
            maxLength={10}
            onChange={(e) => {
              setServerError(null)
              setNickname(e.target.value)
            }}
            aria-invalid={!!nickError}
          />
          {nickError && <p className="mt-1.5 text-[13px] text-danger">{nickError}</p>}
        </div>
        <p className="text-[13px] text-text-muted">
          키·체중·목표는 <Link to="/my/body" className="font-medium text-primary underline-offset-2 hover:underline">신체 정보 · 목표</Link>에서 바꿀 수 있어요.
        </p>
        <fieldset disabled={!hasSensitive}>
          <Label asChild>
            <legend>사용 중인 약</legend>
          </Label>
          <ChipGroup label="사용 중인 약" columns={3} options={MEDICATION_LIST.map((m) => ({ value: m.id, label: m.name }))} value={med} onChange={setMed} />
          {!hasSensitive && <p className="mt-1.5 text-[12px] text-text-subtle">민감정보 동의 후 저장할 수 있어요.</p>}
        </fieldset>
        <Button size="lg" className="w-full" disabled={!!nickError || saving} onClick={save}>
          {saving ? '저장 중…' : '저장'}
        </Button>
      </Card>
    </>
  )
}
