import { useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { PageHeader } from '@/components/common/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { CONSENT_ITEMS, type ConsentId } from '@/fixtures/consents'
import { dbErrorMessage, isLive } from '@/lib/supabase'
import { setConsent, withdrawSensitive } from '@/services/live/account'
import { useAuthStore } from '@/stores/authStore'

import { MyGroup, SettingRow } from './MyRow'

const WITHDRAW_LABEL: Record<string, string> = {
  doses: '투약',
  symptoms: '증상',
  body_logs: '체중·체성분',
  intake_logs_medicine: '복용약 기록',
}

/** 동의 관리 — 필수 항목 철회는 탈퇴 또는 기록 삭제로 이어지므로 확인 후 처리 */
export function ConsentPage() {
  const navigate = useNavigate()
  const account = useAuthStore((s) => s.account)
  const [mockState, setMockState] = useState<Record<ConsentId, boolean>>(() =>
    Object.fromEntries(CONSENT_ITEMS.map((c) => [c.id, c.required || c.id === 'photo_improve'])) as Record<ConsentId, boolean>,
  )
  const state: Record<ConsentId, boolean> = isLive
    ? (Object.fromEntries(CONSENT_ITEMS.map((c) => [c.id, !!account?.consents.includes(c.id)])) as Record<ConsentId, boolean>)
    : mockState
  const [pending, setPending] = useState<ConsentId | null>(null)
  const [busy, setBusy] = useState(false)
  const pendingItem = CONSENT_ITEMS.find((c) => c.id === pending)

  const toggle = async (id: ConsentId, on: boolean) => {
    if (!isLive) {
      setMockState((s) => ({ ...s, [id]: on }))
      return void toast(`목업: ${CONSENT_ITEMS.find((c) => c.id === id)!.title} ${on ? '동의' : '철회'}`)
    }
    if (!account) return
    setBusy(true)
    try {
      await setConsent(account.userId, id, on)
      await useAuthStore.getState().refreshAccount()
      toast(on ? '동의했어요' : '동의를 철회했어요')
    } catch (e) {
      toast.error('바꾸지 못했어요', { description: dbErrorMessage(e) })
    } finally {
      setBusy(false)
    }
  }

  const confirmWithdraw = async () => {
    if (!pending) return
    if (!isLive) {
      setMockState((s) => ({ ...s, [pending]: false }))
      toast('목업: 철회 처리됐어요 (실제 삭제 없음)')
      return setPending(null)
    }
    if (pending !== 'sensitive') {
      // 이용약관·개인정보 철회 = 탈퇴 → 사진 파일까지 지워야 해서 서버 API 필요
      toast('준비 중 · 이 동의 철회는 회원 탈퇴로 처리돼요. 탈퇴는 서버 연결 후 열려요.')
      return setPending(null)
    }
    setBusy(true)
    try {
      const counts = await withdrawSensitive()
      const summary = Object.entries(WITHDRAW_LABEL)
        .map(([k, label]) => (counts[k] ? `${label} ${counts[k]}건` : null))
        .filter(Boolean)
        .join(', ')
      toast('민감정보 동의를 철회했어요', { description: summary ? `${summary}을 지웠어요.` : '지울 기록이 없었어요.' })
      setPending(null)
      await useAuthStore.getState().refreshAccount()
      navigate('/consent', { replace: true }) // 필수 동의가 빠졌으니 다시 동의해야 기록 기능을 쓸 수 있음
    } catch (e) {
      toast.error('철회하지 못했어요', { description: dbErrorMessage(e) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader title="개인정보 · 보안" description="동의한 내용을 확인하고 바꿀 수 있어요" back="/my/settings" />
      <div className="space-y-6 md:max-w-2xl">
        <MyGroup title={isLive ? '동의 항목' : '동의 항목 · 최근 동의 2026.09.23 (예시)'}>
          {CONSENT_ITEMS.map((c) => (
            <SettingRow
              key={c.id}
              id={`consent-${c.id}`}
              label={c.title}
              description={
                <>
                  <Badge tone={c.required ? 'neutral' : 'info'} className="mr-1.5 px-2 py-0 text-[11px]">
                    {c.required ? '필수' : '선택'}
                  </Badge>
                  {c.summary}
                </>
              }
            >
              <Switch
                id={`consent-${c.id}`}
                checked={state[c.id]}
                disabled={busy}
                onCheckedChange={(v) => {
                  if (!v && c.withdrawWarning) return setPending(c.id)
                  void toggle(c.id, v)
                }}
              />
            </SettingRow>
          ))}
        </MyGroup>
        <p className="px-1 text-[12px] leading-relaxed text-text-subtle">
          투약·증상·체성분 같은 건강 정보는 개인정보 보호법 제23조의 민감정보로, 별도 동의를 받은 경우에만 저장해요. 동의 문구는 출시 전 법률 검토가 필요해요.
        </p>
      </div>
      <ConfirmDialog
        open={!!pending}
        onOpenChange={(o) => !o && setPending(null)}
        title={`${pendingItem?.title ?? ''} 동의를 철회할까요?`}
        description={pendingItem?.withdrawWarning}
        confirmLabel={busy ? '처리 중…' : '철회'}
        tone="danger"
        onConfirm={confirmWithdraw}
      />
    </>
  )
}
