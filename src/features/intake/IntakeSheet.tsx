import { GlassWater, Pill, Plus, Tablets, Trash2, X } from 'lucide-react'
import { useState } from 'react'

import { AppIcon } from '@/components/common/AppIcon'
import { BottomSheet } from '@/components/common/BottomSheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatTime, toDateTimeLocalValue } from '@/lib/date'
import { cn } from '@/lib/utils'
import { summarizeIntake, useIntakeStore, type IntakeKind } from '@/stores/intakeStore'

type Tab = 'water' | IntakeKind
const TABS: { id: Tab; label: string; icon: typeof GlassWater }[] = [
  { id: 'water', label: '물', icon: GlassWater },
  { id: 'supplement', label: '영양제', icon: Pill },
  { id: 'medicine', label: '복용약', icon: Tablets },
]
const isToday = (iso: string) => new Date(iso).toDateString() === new Date().toDateString()

function WaterTab() {
  const { water, waterGoalMl, addWater, removeWater } = useIntakeStore()
  const [custom, setCustom] = useState('')
  const today = water.filter((w) => isToday(w.at)).sort((a, b) => b.at.localeCompare(a.at))
  const { ml } = summarizeIntake({ water, logs: [] })
  const pct = Math.min(100, Math.round((ml / waterGoalMl) * 100))
  const customMl = Number(custom)
  const customOk = Number.isInteger(customMl) && customMl >= 10 && customMl <= 3000

  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-surface-muted px-5 py-4">
        <p className="text-[13px] text-text-muted">오늘 마신 물</p>
        <p className="tabular mt-1 text-[32px] leading-tight font-bold">
          {ml.toLocaleString()}
          <span className="ml-1 text-[16px] font-semibold text-text-muted">/ {waterGoalMl.toLocaleString()} mL</span>
        </p>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface" role="progressbar" aria-label="물 목표 대비" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full bg-icon transition-[width]" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-2 text-[12px] text-text-subtle">목표는 마이 &gt; 설정 &gt; 화면 및 앱 환경에서 내가 정해요.</p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {[150, 250, 500].map((v) => (
          <Button key={v} variant="outline" size="lg" className="h-12 rounded-2xl" onClick={() => addWater(v)}>
            +{v}mL
          </Button>
        ))}
      </div>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (!customOk) return
          addWater(customMl)
          setCustom('')
        }}
      >
        <div className="relative flex-1">
          <Input value={custom} onChange={(e) => setCustom(e.target.value.replace(/\D/g, ''))} inputMode="numeric" placeholder="직접 입력" aria-label="마신 양 (mL)" className="pr-12" />
          <span className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-[14px] text-text-muted">mL</span>
        </div>
        <Button type="submit" disabled={!customOk} className="h-12 shrink-0">
          추가
        </Button>
      </form>
      {custom && !customOk && <p className="-mt-3 text-[12px] text-danger">10~3,000mL 사이로 입력해 주세요.</p>}

      <section>
        <h3 className="mb-2 text-[14px] font-semibold">오늘 기록</h3>
        {today.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border px-4 py-5 text-center text-[13px] text-text-muted">아직 기록이 없어요. 위 버튼으로 추가해 보세요.</p>
        ) : (
          <ul className="divide-y divide-border rounded-2xl border border-border">
            {today.map((w) => (
              <li key={w.id} className="flex min-h-12 items-center gap-3 px-4">
                <span className="tabular w-12 text-[13px] text-text-muted">{formatTime(new Date(w.at))}</span>
                <span className="tabular flex-1 text-[15px] font-medium">
                  {w.ml.toLocaleString()}mL
                  {w.legacy && <span className="ml-1.5 text-[12px] font-normal text-text-subtle">기존 컵 기록 환산</span>}
                </span>
                <button type="button" onClick={() => removeWater(w.id)} aria-label={`${w.ml}mL 기록 삭제`} className="inline-flex size-10 items-center justify-center rounded-full hover:bg-surface-muted">
                  <AppIcon icon={X} size="sm" tone="muted" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

/** 영양제·복용약 공통 — 등록한 항목 목록 + 실제 섭취(복용) 시각 기록 */
function ItemTab({ kind }: { kind: IntakeKind }) {
  const { items, logs, addItem, removeItem, logItem, unlog } = useIntakeStore()
  const [name, setName] = useState('')
  const [times, setTimes] = useState<Record<string, string>>({})
  const [openedAt] = useState(() => Date.now())
  const mine = items.filter((i) => i.kind === kind)
  const noun = kind === 'supplement' ? '영양제' : '복용약'
  const verb = kind === 'supplement' ? '섭취' : '복용'
  const nowLocal = () => toDateTimeLocalValue(new Date())

  return (
    <div className="space-y-5">
      {kind === 'medicine' && (
        <p className="rounded-2xl bg-surface-muted px-4 py-3 text-[13px] leading-relaxed text-text-muted">
          마운자로·위고비·에페 같은 주사는 홈의 ‘투약’에서 기록해요. 앱은 약의 복용량이나 복용 주기를 추천하지 않아요.
        </p>
      )}
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (!name.trim()) return
          addItem(kind, name.trim())
          setName('')
        }}
      >
        <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={30} placeholder={`${noun} 이름 (예: ${kind === 'supplement' ? '유산균' : '처방받은 약 이름'})`} aria-label={`${noun} 이름`} />
        <Button type="submit" disabled={!name.trim()} className="h-12 shrink-0">
          <Plus size={18} strokeWidth={1.75} aria-hidden /> 등록
        </Button>
      </form>

      {mine.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border px-4 py-6 text-center text-[13px] text-text-muted">
          등록한 {noun}이 없어요. 이름을 등록하면 매일 {verb} 여부를 기록할 수 있어요.
        </p>
      ) : (
        <ul className="space-y-3">
          {mine.map((item) => {
            const todayLogs = logs.filter((l) => l.itemId === item.id && isToday(l.at)).sort((a, b) => a.at.localeCompare(b.at))
            const time = times[item.id] ?? nowLocal()
            const future = new Date(time).getTime() > openedAt + 60_000
            return (
              <li key={item.id} className="rounded-2xl border border-border p-4">
                <div className="flex items-center gap-2">
                  <p className="flex-1 text-[15px] font-semibold">{item.name}</p>
                  <span className={cn('text-[12px] font-medium', todayLogs.length ? 'text-primary' : 'text-text-subtle')}>
                    {todayLogs.length ? `오늘 ${verb} ${todayLogs.length}회` : `오늘 ${verb} 기록 없음`}
                  </span>
                  <button type="button" onClick={() => removeItem(item.id)} aria-label={`${item.name} 삭제`} className="inline-flex size-9 items-center justify-center rounded-full hover:bg-surface-muted">
                    <AppIcon icon={Trash2} size="sm" tone="muted" className="size-[18px]" />
                  </button>
                </div>
                {todayLogs.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {todayLogs.map((l) => (
                      <button
                        key={l.id}
                        type="button"
                        onClick={() => unlog(l.id)}
                        className="tabular inline-flex h-8 items-center gap-1 rounded-full bg-primary-soft px-3 text-[13px] font-medium text-primary"
                        aria-label={`${formatTime(new Date(l.at))} ${verb} 기록 취소`}
                      >
                        {formatTime(new Date(l.at))} {verb}
                        <X size={13} strokeWidth={2} aria-hidden />
                      </button>
                    ))}
                  </div>
                )}
                <div className="mt-3 flex gap-2">
                  <Input
                    type="datetime-local"
                    value={time}
                    max={nowLocal()}
                    onChange={(e) => setTimes((t) => ({ ...t, [item.id]: e.target.value }))}
                    aria-label={`${item.name} ${verb} 시각`}
                    className="h-11 flex-1 text-[14px]"
                  />
                  <Button
                    size="sm"
                    className="h-11 shrink-0"
                    disabled={future}
                    onClick={() => {
                      if (new Date(time).getTime() <= Date.now() + 60_000) logItem(item.id, new Date(time).toISOString())
                    }}
                  >
                    {verb} 기록
                  </Button>
                </div>
                {future && <p className="mt-1.5 text-[12px] text-danger">미래 시각은 기록할 수 없어요.</p>}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

/** 섭취 관리 — 물 · 영양제 · 복용약 3탭 */
export function IntakeSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('water')
  return (
    <BottomSheet
      open={open}
      onRequestClose={onClose}
      title="섭취 관리"
      description="실제로 마시고 먹은 것만 기록해요"
    >
      <div className="sticky -top-4 z-10 -mx-5 -mt-4 bg-surface px-5 pt-1 pb-4 md:-mx-6 md:px-6">
        <div role="tablist" aria-label="섭취 종류" className="grid grid-cols-3 gap-1 rounded-2xl bg-surface-muted p-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`intake-tab-${t.id}`}
              aria-selected={tab === t.id}
              aria-controls="intake-panel"
              onClick={() => setTab(t.id)}
              className={cn(
                'inline-flex h-10 items-center justify-center gap-1.5 rounded-xl text-[14px] font-medium',
                tab === t.id ? 'bg-surface font-semibold text-text shadow-[0_1px_2px_rgba(15,23,42,0.08)]' : 'text-text-muted',
              )}
            >
              <AppIcon icon={t.icon} size="sm" tone={tab === t.id ? 'primary' : 'muted'} className="size-[18px]" />
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <div id="intake-panel" role="tabpanel" aria-labelledby={`intake-tab-${tab}`}>
        {tab === 'water' ? <WaterTab /> : <ItemTab key={tab} kind={tab} />}
      </div>
    </BottomSheet>
  )
}
