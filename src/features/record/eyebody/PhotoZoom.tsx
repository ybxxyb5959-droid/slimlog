import { Minus, Plus, X } from 'lucide-react'
import { Dialog as DialogPrimitive } from 'radix-ui'
import { useState } from 'react'

import { VaultImage } from './VaultImage'

/**
 * 사진 크게 보기 — 화면 전체. 두 번 탭 또는 +/− 로 확대, 확대하면 손가락으로 끌어서 이동.
 * 다운로드·공유·갤러리 저장 버튼은 일부러 두지 않는다.
 */
export function PhotoZoom({ photo, title, onClose }: { photo: { id: string } | null; title: string; onClose: () => void }) {
  const [scale, setScale] = useState(1)
  const set = (s: number) => setScale(Math.min(4, Math.max(1, Math.round(s * 2) / 2)))
  return (
    <DialogPrimitive.Root
      open={!!photo}
      onOpenChange={(o) => {
        if (!o) {
          setScale(1)
          onClose()
        }
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/90" />
        <DialogPrimitive.Content aria-describedby={undefined} className="fixed inset-0 z-50 flex flex-col outline-none">
          <div className="flex items-center justify-between px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2 text-white">
            <DialogPrimitive.Title className="text-[15px] font-semibold">{title}</DialogPrimitive.Title>
            <DialogPrimitive.Close aria-label="닫기" className="inline-flex size-11 items-center justify-center rounded-full hover:bg-white/10">
              <X size={22} aria-hidden />
            </DialogPrimitive.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-auto" onDoubleClick={() => set(scale > 1 ? 1 : 2)}>
            {photo && (
              <div className="flex min-h-full items-center justify-center" style={{ width: `${scale * 100}%`, height: scale > 1 ? `${scale * 100}%` : undefined }}>
                <VaultImage id={photo.id} alt={title} className="max-h-full w-full object-contain select-none" draggable={false} />
              </div>
            )}
          </div>
          <div className="flex items-center justify-center gap-3 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))] text-white">
            <button type="button" aria-label="축소" disabled={scale <= 1} onClick={() => set(scale - 0.5)} className="inline-flex size-11 items-center justify-center rounded-full bg-white/10 disabled:opacity-30">
              <Minus size={20} aria-hidden />
            </button>
            <span className="tabular w-14 text-center text-[14px]" aria-live="polite">
              {scale}배
            </span>
            <button type="button" aria-label="확대" disabled={scale >= 4} onClick={() => set(scale + 0.5)} className="inline-flex size-11 items-center justify-center rounded-full bg-white/10 disabled:opacity-30">
              <Plus size={20} aria-hidden />
            </button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
