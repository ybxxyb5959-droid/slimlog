import { cn } from '@/lib/utils'

import type { ProviderId } from './providers'

/** 각 사 로그인 버튼 가이드의 심볼 (로그인 버튼 용도로만 사용) */
export function ProviderMark({ provider, className }: { provider: ProviderId; className?: string }) {
  const cls = cn('shrink-0', className)
  if (provider === 'kakao')
    return (
      <svg viewBox="0 0 24 24" className={cls} aria-hidden>
        <path fill="#191919" d="M12 3.2C6.6 3.2 2.3 6.6 2.3 10.8c0 2.7 1.8 5.1 4.5 6.4l-.9 3.4c-.1.3.3.5.5.3l4-2.7c.5.1 1 .1 1.6.1 5.4 0 9.7-3.4 9.7-7.6S17.4 3.2 12 3.2z" />
      </svg>
    )
  if (provider === 'google')
    return (
      <svg viewBox="0 0 48 48" className={cls} aria-hidden>
        <path fill="#FBBC05" d="M43.6 20.1H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z" />
        <path fill="#EA4335" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
        <path fill="#34A853" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2A11.9 11.9 0 0 1 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
        <path fill="#4285F4" d="M43.6 20.1H42V20H24v8h11.3a12 12 0 0 1-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.9z" />
      </svg>
    )
  if (provider === 'apple')
    return (
      <svg viewBox="0 0 24 24" className={cls} aria-hidden>
        <path
          fill="currentColor"
          d="M16.4 12.6c0-2.6 2.1-3.9 2.2-3.9-1.2-1.8-3.1-2-3.8-2-1.6-.2-3.1.9-3.9.9-.8 0-2.1-.9-3.4-.9-1.7 0-3.3 1-4.3 2.6-1.8 3.1-.5 7.8 1.3 10.3.9 1.3 1.9 2.7 3.2 2.6 1.3-.1 1.8-.8 3.4-.8 1.6 0 2 .8 3.4.8 1.4 0 2.3-1.3 3.1-2.5 1-1.5 1.4-2.9 1.4-2.9s-2.7-1.1-2.6-4.2zM13.8 5c.7-.9 1.2-2.1 1.1-3.3-1 0-2.3.7-3 1.6-.7.8-1.2 2-1.1 3.2 1.1.1 2.3-.6 3-1.5z"
        />
      </svg>
    )
  return (
    <svg viewBox="0 0 24 24" className={cls} aria-hidden>
      <path fill="currentColor" d="M14.2 12.6 9.6 6H6v12h3.8v-6.6l4.6 6.6H18V6h-3.8z" />
    </svg>
  )
}

const BUTTON: Record<ProviderId, string> = {
  kakao: 'bg-[#FEE500] text-black/85 hover:brightness-95',
  google: 'border border-border bg-white text-[#1f1f1f] hover:bg-surface-muted',
  apple: 'bg-black text-white hover:bg-black/85',
  naver: 'bg-[#03C75A] text-white hover:brightness-95',
}

export function ProviderButton({ provider, label, onClick }: { provider: ProviderId; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'relative flex h-[52px] w-full items-center justify-center rounded-xl text-[15px] font-semibold transition outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2',
        BUTTON[provider],
      )}
    >
      <ProviderMark provider={provider} className="absolute left-4 size-5" />
      {label}
    </button>
  )
}
