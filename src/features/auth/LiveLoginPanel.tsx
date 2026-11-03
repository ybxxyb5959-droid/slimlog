import { useEffect, useState } from 'react'
import { Navigate } from 'react-router'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { dbErrorMessage, devLoginEnabled } from '@/lib/supabase'
import { nextPathFor } from '@/services/live/account'
import { devEmailLogin, enabledProviders, startOAuth } from '@/services/live/auth'
import { useAuthStore } from '@/stores/authStore'

import { ProviderButton } from './ProviderMark'
import { PROVIDERS, type ProviderId } from './providers'

/** 실서비스 로그인 — 켜진 소셜 로그인만 누를 수 있고, 아직 연결 안 된 건 이유를 보여준다 */
export function LiveLoginPanel() {
  const { status, account } = useAuthStore()
  const [enabled, setEnabled] = useState<Partial<Record<ProviderId, boolean>> | null>(null)
  const [busy, setBusy] = useState<ProviderId | 'dev' | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  useEffect(() => {
    enabledProviders()
      .then(setEnabled)
      .catch(() => setEnabled({}))
  }, [])

  if (status === 'signedIn' && account) return <Navigate to={nextPathFor(account)} replace />

  const onProvider = async (id: ProviderId) => {
    if (id === 'naver' || !enabled?.[id]) {
      toast('아직 연결되지 않은 로그인이에요', { description: PROVIDERS.find((p) => p.id === id)?.note })
      return
    }
    setBusy(id)
    try {
      await startOAuth(id)
    } catch (e) {
      toast.error('로그인을 시작하지 못했어요', { description: dbErrorMessage(e) })
      setBusy(null)
    }
  }

  const onDev = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy('dev')
    try {
      await devEmailLogin(email.trim(), password)
    } catch (err) {
      toast.error('로그인 실패', { description: dbErrorMessage(err) })
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-2.5">
      {PROVIDERS.filter((p) => p.enabled).map((p) => {
        const on = !!enabled?.[p.id]
        return (
          <div key={p.id}>
            <ProviderButton provider={p.id} label={busy === p.id ? '이동 중…' : p.label} disabled={busy !== null} onClick={() => onProvider(p.id)} />
            {enabled && !on && <p className="mt-1 px-1 text-[12px] text-text-subtle">준비 중 · 아직 연결되지 않았어요</p>}
          </div>
        )
      })}

      {devLoginEnabled && (
        <form onSubmit={onDev} className="mt-4 space-y-2 rounded-2xl border border-dashed border-border p-3" aria-label="개발용 로그인">
          <p className="text-[12px] font-semibold text-text-muted">개발용 로그인 (로컬 Supabase 전용 · 운영 빌드에는 없음)</p>
          <Input type="email" required placeholder="test@slimlog.local" aria-label="개발용 이메일" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Input type="password" required minLength={6} placeholder="비밀번호 6자 이상" aria-label="개발용 비밀번호" value={password} onChange={(e) => setPassword(e.target.value)} />
          <Button type="submit" variant="outline" className="w-full" disabled={busy !== null}>
            {busy === 'dev' ? '로그인 중…' : '개발용 계정으로 로그인'}
          </Button>
        </form>
      )}
    </div>
  )
}
