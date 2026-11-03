import { ChevronLeft, ChevronRight, Syringe } from 'lucide-react'
import { Slider } from 'radix-ui'
import { useRef } from 'react'

import { cn } from '@/lib/utils'

import { AppIcon } from './AppIcon'

const THUMB = 24

/**
 * 단일 값 용량 선택기 — 가운데 큰 숫자 하나.
 * 바꾸는 방법: 숫자 영역 좌우 스와이프 / 슬라이더 드래그 / 좌우 버튼 / 눈금 탭 / 키보드 ←→
 */
export function SwipeDosePicker({
  options,
  value,
  onChange,
  label,
}: {
  options: number[]
  value: number
  onChange: (mg: number) => void
  label: string
}) {
  const idx = Math.max(0, options.indexOf(value))
  const start = useRef<number | null>(null)
  const go = (i: number) => onChange(options[Math.min(options.length - 1, Math.max(0, i))])
  const pos = (i: number) => (options.length === 1 ? 0.5 : i / (options.length - 1))

  return (
    <div className="space-y-5">
      <div
        className="relative flex touch-pan-y items-center justify-between rounded-3xl bg-surface-muted px-3 py-7 select-none"
        onPointerDown={(e) => {
          if ((e.target as HTMLElement).closest('button')) return
          start.current = e.clientX
        }}
        onPointerUp={(e) => {
          if (start.current === null) return
          const dx = e.clientX - start.current
          start.current = null
          if (Math.abs(dx) > 36) go(idx + (dx < 0 ? 1 : -1))
        }}
        onPointerCancel={() => (start.current = null)}
      >
        <button
          type="button"
          onClick={() => go(idx - 1)}
          disabled={idx === 0}
          aria-label="이전 용량"
          className="inline-flex size-11 items-center justify-center rounded-full border border-border bg-surface disabled:opacity-30"
        >
          <AppIcon icon={ChevronLeft} size="sm" tone="text" />
        </button>

        <div className="flex flex-col items-center" aria-live="polite">
          <AppIcon icon={Syringe} size="lg" />
          <p className="tabular mt-2 text-[44px] leading-none font-bold tracking-tight text-text">
            {value}
            <span className="ml-1 text-[18px] font-semibold text-text-muted">mg</span>
          </p>
          <p className="tabular mt-2 text-[13px] text-text-muted">
            {idx + 1} / {options.length}
          </p>
        </div>

        <button
          type="button"
          onClick={() => go(idx + 1)}
          disabled={idx === options.length - 1}
          aria-label="다음 용량"
          className="inline-flex size-11 items-center justify-center rounded-full border border-border bg-surface disabled:opacity-30"
        >
          <AppIcon icon={ChevronRight} size="sm" tone="text" />
        </button>
      </div>

      <div className="px-1">
        <Slider.Root
          className="relative flex h-8 w-full touch-none items-center select-none"
          min={0}
          max={options.length - 1}
          step={1}
          value={[idx]}
          onValueChange={([i]) => go(i)}
          aria-label={label}
        >
          <Slider.Track className="relative h-2 grow overflow-hidden rounded-full bg-surface-muted">
            <Slider.Range className="absolute h-full rounded-full bg-icon" />
          </Slider.Track>
          <Slider.Thumb
            aria-valuetext={`${value}mg`}
            className="block rounded-full border-[3px] border-icon bg-surface shadow-[0_1px_4px_rgba(15,23,42,0.2)] outline-none focus-visible:ring-4 focus-visible:ring-icon/25"
            style={{ width: THUMB, height: THUMB }}
          />
        </Slider.Root>
        <div className="relative mt-1 h-8" aria-hidden>
          {options.map((mg, i) => (
            <button
              key={mg}
              type="button"
              tabIndex={-1}
              onClick={() => go(i)}
              className={cn(
                'tabular absolute top-0 h-8 -translate-x-1/2 px-1 text-[12px]',
                i === idx ? 'font-bold text-icon' : 'text-text-muted',
              )}
              style={{ left: `calc(${pos(i)} * (100% - ${THUMB}px) + ${THUMB / 2}px)` }}
            >
              {mg}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
