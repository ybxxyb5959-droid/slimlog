import type * as React from 'react'

import { Logo } from '@/components/brand/Logo'
import { cn } from '@/lib/utils'

/**
 * 온보딩 공통 틀: 상단 로고·진행률 / 본문 스크롤 / 하단 고정 CTA
 * 키보드가 열리면(viewport resize) 하단 CTA가 키보드 바로 위에 붙는다.
 */
export function OnboardingShell({
  step,
  total = 4,
  title,
  description,
  children,
  footer,
}: {
  step: number
  total?: number
  title: React.ReactNode
  description?: React.ReactNode
  children: React.ReactNode
  footer: React.ReactNode
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="sticky top-0 z-10 bg-background/95 pt-[var(--sat)] backdrop-blur">
        <div className="mx-auto w-full max-w-[480px] px-5 pt-4 pb-3">
          <div className="flex items-center justify-between">
            <Logo size={26} />
            <span className="tabular text-[13px] font-semibold text-text-muted" aria-hidden>
              {step} / {total}
            </span>
          </div>
          <div
            className="mt-3 grid gap-1.5"
            style={{ gridTemplateColumns: `repeat(${total}, 1fr)` }}
            role="progressbar"
            aria-label={`온보딩 ${total}단계 중 ${step}단계`}
            aria-valuemin={1}
            aria-valuemax={total}
            aria-valuenow={step}
          >
            {Array.from({ length: total }).map((_, i) => (
              <span key={i} className={cn('h-1.5 rounded-full transition-colors', i < step ? 'bg-primary' : 'bg-primary-soft')} />
            ))}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[480px] flex-1 px-5 pt-6 pb-6">
        <h1 className="text-[26px] leading-[1.3] font-bold tracking-tight text-balance break-keep text-text">{title}</h1>
        {description && <p className="mt-3 text-[15px] leading-relaxed break-keep text-text-muted">{description}</p>}
        <div className="mt-7">{children}</div>
      </main>

      <footer className="sticky bottom-0 z-10 border-t border-border/60 bg-background/95 backdrop-blur">
        <div className="mx-auto w-full max-w-[480px] px-5 pt-3 pb-[max(0.75rem,var(--sab))]">{footer}</div>
      </footer>
    </div>
  )
}
