import { X } from 'lucide-react'
import { Dialog as DialogPrimitive } from 'radix-ui'
import { useRef, useState } from 'react'
import type * as React from 'react'

import { cn } from '@/lib/utils'

import { AppIcon } from './AppIcon'

/**
 * 모바일: 화면 하단에서 올라오는 바텀시트 (드래그 핸들 · 아래로 스와이프해 닫기)
 * 768px 이상: 가운데 모달
 * 닫기 요청(스와이프·배경 탭·Esc·X)은 모두 onRequestClose로 모인다 → 부모가 확인 처리
 */
export function BottomSheet({
  open,
  onRequestClose,
  title,
  description,
  header,
  footer,
  children,
  className,
}: {
  open: boolean
  onRequestClose: () => void
  title: React.ReactNode
  description?: React.ReactNode
  /** 제목 위(진행률·뒤로가기 등) */
  header?: React.ReactNode
  footer?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  const [dragY, setDragY] = useState(0)
  const start = useRef<{ y: number; t: number } | null>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const returnFocus = useRef<HTMLElement | null>(null)

  const onPointerDown = (e: React.PointerEvent) => {
    if (window.matchMedia('(min-width: 768px)').matches) return
    if ((e.target as HTMLElement).closest('button')) return
    start.current = { y: e.clientY, t: performance.now() }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (!start.current) return
    setDragY(Math.max(0, e.clientY - start.current.y))
  }
  const onPointerUp = (e: React.PointerEvent) => {
    if (!start.current) return
    const dy = Math.max(0, e.clientY - start.current.y)
    const v = dy / Math.max(1, performance.now() - start.current.t)
    start.current = null
    setDragY(0)
    if (dy > 110 || (dy > 40 && v > 0.6)) onRequestClose()
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(o) => !o && onRequestClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="sheet-overlay fixed inset-0 z-50 bg-slate-900/45" />
        <DialogPrimitive.Content
          ref={contentRef}
          tabIndex={-1}
          onOpenAutoFocus={(e) => {
            // 닫기 버튼에 포커스 링이 먼저 뜨지 않도록 시트 자체에 포커스 (Tab으로 내부 이동)
            e.preventDefault()
            const active = document.activeElement
            returnFocus.current = active instanceof HTMLElement && active !== document.body ? active : null
            contentRef.current?.focus()
          }}
          onCloseAutoFocus={(e) => {
            // 닫으면 열기 전 포커스 위치로 복원 (Trigger 없이 열린 경우 포함)
            if (returnFocus.current?.isConnected) {
              e.preventDefault()
              returnFocus.current.focus()
            }
          }}
          className={cn(
            'sheet-content fixed z-50 flex flex-col bg-surface outline-none',
            'inset-x-0 bottom-0 max-h-[92dvh] rounded-t-[28px]',
            'md:inset-auto md:top-1/2 md:left-1/2 md:max-h-[min(760px,90dvh)] md:w-[min(560px,calc(100vw-48px))] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-3xl',
            className,
          )}
          style={dragY ? { transform: `translateY(${dragY}px)`, transition: 'none' } : undefined}
        >
          {/* 드래그 영역: 핸들 + 헤더 */}
          <div
            className="shrink-0 touch-none px-5 pt-2 md:touch-auto md:px-6 md:pt-5"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            <div className="flex justify-center pb-2 md:hidden" aria-hidden>
              <span className="h-1.5 w-10 rounded-full bg-border" />
            </div>
            {header}
            <div className="flex items-start gap-3 pt-2">
              <div className="min-w-0 flex-1">
                <DialogPrimitive.Title className="text-[20px] leading-snug font-bold tracking-tight text-text">{title}</DialogPrimitive.Title>
                {description ? (
                  <DialogPrimitive.Description className="mt-1 text-[14px] text-text-muted">{description}</DialogPrimitive.Description>
                ) : (
                  <DialogPrimitive.Description className="sr-only">단계별 입력</DialogPrimitive.Description>
                )}
              </div>
              <button
                type="button"
                onClick={onRequestClose}
                className="-mt-1 -mr-2 inline-flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-surface-muted"
                aria-label="닫기"
              >
                <AppIcon icon={X} size="sm" tone="muted" />
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pt-4 pb-4 md:px-6">{children}</div>

          {footer && (
            <div className="shrink-0 border-t border-border px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] md:px-6 md:pb-5">{footer}</div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
