import { Mail } from 'lucide-react'
import { Link, useNavigate } from 'react-router'
import { toast } from 'sonner'

import { Logo } from '@/components/brand/Logo'
import { Button } from '@/components/ui/button'

import { AuthShell } from './AuthShell'
import { ProviderButton } from './ProviderMark'
import { PROVIDERS } from './providers'

export function LoginPage() {
  const navigate = useNavigate()
  const go = (label: string) => {
    toast(`목업: ${label} — 실제 로그인 없이 다음 화면으로 이동해요`)
    navigate('/consent')
  }

  return (
    <AuthShell>
      <div className="flex flex-1 flex-col items-center justify-center py-10 md:flex-none md:py-0 md:pb-12">
        <h1 className="sr-only">SlimLog 로그인</h1>
        <Logo variant="vertical" size={84} />
        <p className="mt-6 max-w-[260px] text-center text-[14px] leading-relaxed text-balance text-text-muted break-keep">
          투약·식단·체중·컨디션을 하나의 날짜로 모아 봐요
        </p>
      </div>

      <div className="space-y-2.5">
        {PROVIDERS.filter((p) => p.enabled).map((p) => (
          <ProviderButton key={p.id} provider={p.id} label={p.label} onClick={() => go(p.label)} />
        ))}
        <div className="flex items-center gap-3 py-2 text-[12px] text-text-subtle" aria-hidden>
          <span className="h-px flex-1 bg-border" />
          또는
          <span className="h-px flex-1 bg-border" />
        </div>
        <Button asChild variant="outline" size="lg" className="h-[52px] w-full">
          <Link to="/signup">
            <Mail size={18} strokeWidth={1.75} aria-hidden /> 이메일로 계속하기
          </Link>
        </Button>
      </div>

      <p className="mt-6 text-center text-[12px] leading-relaxed text-text-subtle">
        계속하면 이용약관과 개인정보 처리방침에 동의하게 돼요.
        <br />
        UI 목업 · 실제 로그인은 연결되어 있지 않아요.
      </p>
    </AuthShell>
  )
}
