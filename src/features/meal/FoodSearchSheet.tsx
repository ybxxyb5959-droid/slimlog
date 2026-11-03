import { Search } from 'lucide-react'
import { useState } from 'react'

import { AppIcon } from '@/components/common/AppIcon'
import { BottomSheet } from '@/components/common/BottomSheet'
import { Input } from '@/components/ui/input'
import { FOODS } from '@/fixtures/foods.mock'

/** 음식 직접 검색 — AI가 못 맞혔거나, 사진 없이 기록할 때 */
export function FoodSearchSheet({ open, onClose, onPick, title = '음식 검색' }: { open: boolean; onClose: () => void; onPick: (foodId: string) => void; title?: string }) {
  const [q, setQ] = useState('')
  const list = FOODS.filter((f) => f.name.includes(q.trim()))
  return (
    <BottomSheet open={open} onRequestClose={onClose} title={title} description="영양 정보는 식약처 DB 대표 1인분 기준이에요 (지금은 예시 값)">
      <div className="relative">
        <AppIcon icon={Search} size="sm" tone="muted" className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="음식 이름" aria-label="음식 이름 검색" className="pl-11" autoFocus />
      </div>
      <ul className="mt-3 divide-y divide-border">
        {list.map((f) => (
          <li key={f.id}>
            <button
              type="button"
              onClick={() => {
                onPick(f.id)
                setQ('')
              }}
              className="flex min-h-13 w-full items-center gap-3 px-1 py-2 text-left hover:bg-surface-muted/60"
            >
              <span className="flex-1">
                <span className="block text-[15px] font-medium">{f.name}</span>
                <span className="block text-[12px] text-text-subtle">{f.kind}</span>
              </span>
              <span className="tabular text-[13px] text-text-muted">{f.kcal}kcal</span>
            </button>
          </li>
        ))}
        {list.length === 0 && <li className="py-8 text-center text-[13px] text-text-muted">찾는 음식이 없어요. 지금은 학습한 20종만 기록할 수 있어요.</li>}
      </ul>
    </BottomSheet>
  )
}
