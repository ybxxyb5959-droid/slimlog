import { Check, ChevronDown } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'

import { PageHeader } from '@/components/common/PageHeader'
import { Button } from '@/components/ui/button'
import { CONSENT_ITEMS, type ConsentId } from '@/fixtures/consents'
import { dbErrorMessage, isLive } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { saveConsents } from '@/services/live/account'
import { useAuthStore } from '@/stores/authStore'

import { AuthShell } from './AuthShell'

function Check2({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex size-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
        checked ? 'border-primary bg-primary text-white' : 'border-border bg-surface text-transparent',
      )}
    >
      <Check size={14} strokeWidth={3} />
    </span>
  )
}

/** 가입 동의 — 민감정보(건강정보)는 별도 필수 동의 (개인정보 보호법 제23조) */
export function ConsentSignupPage() {
  const navigate = useNavigate()
  const [checked, setChecked] = useState<Record<ConsentId, boolean>>(
    () => Object.fromEntries(CONSENT_ITEMS.map((c) => [c.id, false])) as Record<ConsentId, boolean>,
  )
  const all = CONSENT_ITEMS.every((c) => checked[c.id])
  const requiredOk = CONSENT_ITEMS.filter((c) => c.required).every((c) => checked[c.id])
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    if (!isLive) return navigate('/onboarding')
    const { account, refreshAccount } = useAuthStore.getState()
    if (!account) return
    setSaving(true)
    try {
      await saveConsents(account.userId, CONSENT_ITEMS.filter((c) => checked[c.id]).map((c) => c.id))
      await refreshAccount()
      navigate('/onboarding')
    } catch (e) {
      toast.error('동의를 저장하지 못했어요', { description: dbErrorMessage(e) })
    } finally {
      setSaving(false)
    }
  }

  return (
    <AuthShell>
      <PageHeader title="약관 동의" description="슬림로그를 쓰려면 아래 내용에 동의해 주세요" back={isLive ? undefined : "/login"} />
      <button
        type="button"
        role="checkbox"
        aria-checked={all}
        onClick={() => setChecked(Object.fromEntries(CONSENT_ITEMS.map((c) => [c.id, !all])) as Record<ConsentId, boolean>)}
        className="flex min-h-14 w-full items-center gap-3 rounded-2xl border border-border bg-surface px-4 text-left text-[16px] font-bold"
      >
        <Check2 checked={all} /> 전체 동의 (선택 항목 포함)
      </button>

      <ul className="mt-3 space-y-1">
        {CONSENT_ITEMS.map((c) => (
          <li key={c.id}>
            <details className="group">
              <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 px-1">
                <span
                  role="checkbox"
                  aria-checked={checked[c.id]}
                  aria-label={`${c.required ? '필수' : '선택'} ${c.title}`}
                  tabIndex={0}
                  onClick={(e) => {
                    e.preventDefault()
                    setChecked((s) => ({ ...s, [c.id]: !s[c.id] }))
                  }}
                  onKeyDown={(e) => {
                    if (e.key === ' ' || e.key === 'Enter') {
                      e.preventDefault()
                      setChecked((s) => ({ ...s, [c.id]: !s[c.id] }))
                    }
                  }}
                  className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                >
                  <Check2 checked={checked[c.id]} />
                </span>
                <span className="flex-1 text-[14px]">
                  <span className={cn('mr-1 font-semibold', c.required ? 'text-primary' : 'text-text-muted')}>[{c.required ? '필수' : '선택'}]</span>
                  {c.title}
                </span>
                <ChevronDown size={18} strokeWidth={1.75} className="text-text-subtle transition-transform group-open:rotate-180" aria-label="내용 보기" />
              </summary>
              <ul className="mb-2 ml-10 list-disc space-y-1 rounded-xl bg-surface-muted py-3 pr-4 pl-8 text-[13px] leading-relaxed text-text-muted">
                {c.detail.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            </details>
          </li>
        ))}
      </ul>

      <p className="mt-3 px-1 text-[12px] leading-relaxed text-text-subtle">동의 문구는 초안이며 출시 전 법률 검토가 필요해요.</p>
      <div className="mt-auto pt-6">
        <Button size="lg" className="w-full" disabled={!requiredOk || saving} onClick={submit}>
          {saving ? '저장 중…' : '동의하고 시작하기'}
        </Button>
      </div>
    </AuthShell>
  )
}
