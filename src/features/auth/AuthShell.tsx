import type * as React from 'react'

/** 로그인·가입·동의 공통 틀 (탭 없음) */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-background">
      <div className="mx-auto flex min-h-dvh w-full max-w-[420px] flex-col px-5 pt-[max(2.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] md:justify-center md:py-10">
        {children}
      </div>
    </div>
  )
}
