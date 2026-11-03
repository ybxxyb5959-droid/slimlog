import { X } from 'lucide-react'
import { useRef, useState } from 'react'

import { cn } from '@/lib/utils'
import type { PhotoRegion } from '@/stores/mealDraftStore'

/**
 * 사진 위 음식 영역 편집 — 빈 곳을 끌면 새 영역, 영역을 끌면 이동, 오른쪽 아래 손잡이로 크기 조절.
 * 번호(왼쪽 위 안쪽)와 삭제(오른쪽 위 안쪽)를 영역 안에 두어 이웃 영역과 겹치지 않게 한다.
 */
type Mode = { kind: 'draw'; sx: number; sy: number } | { kind: 'move'; i: number; dx: number; dy: number } | { kind: 'resize'; i: number }
const MIN = 8

export function RegionEditor({
  regions,
  onChange,
  selected,
  onSelect,
  children,
  disabled,
}: {
  regions: PhotoRegion[]
  onChange: (r: PhotoRegion[]) => void
  selected: number | null
  onSelect: (i: number | null) => void
  children: React.ReactNode
  disabled?: boolean
}) {
  const box = useRef<HTMLDivElement>(null)
  const mode = useRef<Mode | null>(null)
  const [draft, setDraft] = useState<PhotoRegion | null>(null)
  const clamp = (v: number) => Math.min(100, Math.max(0, v))
  const pt = (e: React.PointerEvent) => {
    const r = box.current!.getBoundingClientRect()
    return { x: clamp(((e.clientX - r.left) / r.width) * 100), y: clamp(((e.clientY - r.top) / r.height) * 100) }
  }

  return (
    <div
      ref={box}
      className={cn('relative aspect-[4/3] w-full max-w-full overflow-hidden rounded-2xl bg-surface-muted select-none', !disabled && 'touch-none')}
      role="application"
      aria-label="식사 사진. 빈 곳을 끌어 음식 영역을 그리고, 영역을 끌어 옮기거나 오른쪽 아래 손잡이로 크기를 바꿔요"
      onPointerDown={(e) => {
        if (disabled) return
        const t = e.target as HTMLElement
        if (t.closest('[data-delete]')) return
        ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
        const p = pt(e)
        const handle = t.closest('[data-handle]') as HTMLElement | null
        const region = t.closest('[data-region]') as HTMLElement | null
        if (handle) {
          const i = Number(handle.dataset.handle)
          mode.current = { kind: 'resize', i }
          onSelect(i)
        } else if (region) {
          const i = Number(region.dataset.region)
          mode.current = { kind: 'move', i, dx: p.x - regions[i].x, dy: p.y - regions[i].y }
          onSelect(i)
        } else {
          mode.current = { kind: 'draw', sx: p.x, sy: p.y }
          onSelect(null)
        }
      }}
      onPointerMove={(e) => {
        const m = mode.current
        if (!m) return
        const p = pt(e)
        if (m.kind === 'draw') setDraft({ x: Math.min(m.sx, p.x), y: Math.min(m.sy, p.y), w: Math.abs(p.x - m.sx), h: Math.abs(p.y - m.sy) })
        else if (m.kind === 'move') {
          const r = regions[m.i]
          onChange(regions.map((x, j) => (j === m.i ? { ...x, x: clamp(Math.min(p.x - m.dx, 100 - r.w)), y: clamp(Math.min(p.y - m.dy, 100 - r.h)) } : x)))
        } else {
          const r = regions[m.i]
          onChange(regions.map((x, j) => (j === m.i ? { ...x, w: Math.max(MIN, p.x - r.x), h: Math.max(MIN, p.y - r.y) } : x)))
        }
      }}
      onPointerUp={() => {
        const m = mode.current
        mode.current = null
        if (m?.kind === 'draw' && draft) {
          if (draft.w >= MIN && draft.h >= MIN && regions.length < 8) {
            onChange([...regions, draft])
            onSelect(regions.length)
          }
          setDraft(null)
        }
      }}
    >
      {children}
      {regions.map((r, i) => {
        const active = selected === i
        return (
          <div
            key={i}
            data-region={i}
            className={cn('absolute rounded-xl border-2 transition-shadow', active ? 'border-white shadow-[0_0_0_2px_var(--icon)]' : 'border-white shadow-[0_0_0_1.5px_rgba(15,23,42,0.55)]', !disabled && 'cursor-move')}
            style={{ left: `${r.x}%`, top: `${r.y}%`, width: `${r.w}%`, height: `${r.h}%` }}
          >
            <span className="absolute top-1 left-1 inline-flex size-6 items-center justify-center rounded-full bg-text text-[12px] font-bold text-surface">{i + 1}</span>
            {!disabled && (
              <>
                <button
                  type="button"
                  data-delete
                  onClick={() => {
                    onChange(regions.filter((_, j) => j !== i))
                    onSelect(null)
                  }}
                  aria-label={`${i + 1}번 영역 지우기`}
                  className="absolute top-1 right-1 inline-flex size-7 items-center justify-center rounded-full bg-surface/95 shadow"
                >
                  <X size={15} strokeWidth={2} aria-hidden />
                </button>
                {active && <span data-handle={i} aria-hidden className="absolute -right-1.5 -bottom-1.5 size-5 cursor-nwse-resize rounded-full border-2 border-white bg-icon shadow" />}
              </>
            )}
          </div>
        )
      })}
      {draft && <div className="absolute rounded-xl border-2 border-dashed border-white bg-white/15" style={{ left: `${draft.x}%`, top: `${draft.y}%`, width: `${draft.w}%`, height: `${draft.h}%` }} />}
    </div>
  )
}
