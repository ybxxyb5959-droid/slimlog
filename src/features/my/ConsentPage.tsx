import { useState } from 'react'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { PageHeader } from '@/components/common/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { CONSENT_ITEMS, type ConsentId } from '@/fixtures/consents'

import { MyGroup, SettingRow } from './MyRow'

/** 동의 관리 — 필수 항목 철회는 탈퇴 또는 기록 삭제로 이어지므로 확인 후 처리 */
export function ConsentPage() {
  const [state, setState] = useState<Record<ConsentId, boolean>>(() =>
    Object.fromEntries(CONSENT_ITEMS.map((c) => [c.id, c.required || c.id === 'photo_improve'])) as Record<ConsentId, boolean>,
  )
  const [pending, setPending] = useState<ConsentId | null>(null)
  const pendingItem = CONSENT_ITEMS.find((c) => c.id === pending)

  return (
    <>
      <PageHeader title="개인정보 · 보안" description="동의한 내용을 확인하고 바꿀 수 있어요" back="/my/settings" />
      <div className="space-y-6 md:max-w-2xl">
        <MyGroup title="동의 항목 · 최근 동의 2026.09.23 (예시)">
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
                onCheckedChange={(v) => {
                  if (!v && c.withdrawWarning) return setPending(c.id)
                  setState((s) => ({ ...s, [c.id]: v }))
                  toast(`목업: ${c.title} ${v ? '동의' : '철회'}`)
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
        confirmLabel="철회"
        tone="danger"
        onConfirm={() => {
          if (pending) setState((s) => ({ ...s, [pending]: false }))
          toast('목업: 철회 처리됐어요 (실제 삭제 없음)')
          setPending(null)
        }}
      />
    </>
  )
}
