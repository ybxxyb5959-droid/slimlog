import { BellRing, CircleCheck, GlassWater, Pill, Plus, Tablets, Trash2, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { toast } from 'sonner'

import { AppIcon } from '@/components/common/AppIcon'
import { BottomSheet } from '@/components/common/BottomSheet'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatTime, hourLabel } from '@/lib/date'
import { cn } from '@/lib/utils'
import { enablePush, pushHint } from '@/lib/push'
import { summarizeIntake, useIntakeStore, type IntakeItem, type IntakeKind } from '@/stores/intakeStore'

import { HourClock } from './HourClock'
import { suggest } from './suggestions'

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

/**
 * 영양제·복용약 공통
 * - 카드를 누르면 오늘 '먹었어요' (다시 누르면 취소), '건너뛰기'도 남길 수 있다
 * - 처음 먹었어요를 누르면 매일 알림을 받을지 한 번 묻는다 → 확인 시 시계로 '시' 고르기 → 폰 푸시 등록
 */
function ItemTab({ kind, onRegistered }: { kind: IntakeKind; onRegistered: (key: string) => void }) {
  const { items, logs, addItem, removeItem, logItem, unlog, setReminder } = useIntakeStore()
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [clockFor, setClockFor] = useState<IntakeItem | null>(null)
  const [hour, setHour] = useState(9)
  const mine = items.filter((i) => i.kind === kind)
  const noun = kind === 'supplement' ? '영양제' : '복용약'
  const verb = kind === 'supplement' ? '섭취' : '복용'
  const todayOf = (id: string) => logs.filter((l) => l.itemId === id && isToday(l.at)).sort((a, b) => b.at.localeCompare(a.at))[0]
  const doneCount = mine.filter((i) => todayOf(i.id)?.status !== 'skipped' && todayOf(i.id)).length
  const hints = suggest(name, items.filter((i) => i.kind === kind).map((i) => i.name), kind === 'supplement' ? undefined : [])

  const register = (n: string) => {
    if (!n.trim()) return
    // 등록하면 오늘 섭취로 바로 체크 (알림은 시트를 닫을 때 한 번만 물어봄)
    const id = addItem(kind, n.trim())
    logItem(id, new Date().toISOString(), 'taken')
    onRegistered(`${kind}:${n.trim()}`)
    setName('')
    setAdding(false)
  }

  const toggleTaken = (item: IntakeItem) => {
    const t = todayOf(item.id)
    if (t) return unlog(t.id)
    logItem(item.id, new Date().toISOString(), 'taken')
  }

  const openClock = (item: IntakeItem) => {
    setHour(item.remindHour ?? new Date().getHours())
    setClockFor(item)
  }

  const saveReminder = async () => {
    if (!clockFor) return
    setReminder(clockFor.id, { enabled: true, hour, asked: true })
    setClockFor(null)
    const r = await enablePush()
    if (r === 'subscribed') toast.success(`매일 ${hourLabel(hour)}에 알려드릴게요`)
    else toast(`매일 ${hourLabel(hour)}로 저장했어요`, { description: pushHint(r) })
  }

  return (
    <div className="space-y-4">
      {kind === 'medicine' && (
        <p className="rounded-2xl bg-surface-muted px-4 py-3 text-[13px] leading-relaxed text-text-muted">
          마운자로·위고비·에페 같은 주사는 홈의 ‘투약’에서 기록해요. 앱은 약의 복용량이나 복용 주기를 추천하지 않아요.
        </p>
      )}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[18px] font-bold">오늘의 {noun}</h3>
          <p className="text-[13px] text-text-muted">
            {doneCount}개 {verb} 완료
          </p>
        </div>
        <Button variant="outline" size="sm" className="h-10 rounded-full border-icon px-4 text-icon" aria-expanded={adding} onClick={() => setAdding((v) => !v)}>
          <Plus size={16} strokeWidth={2} aria-hidden /> 등록
        </Button>
      </div>

      {adding && (
        <form
          className="space-y-2 rounded-2xl bg-surface-muted p-3"
          onSubmit={(e) => {
            e.preventDefault()
            register(name)
          }}
        >
          <p className="px-1 text-[14px] font-semibold">새 {noun} 등록</p>
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={30}
            placeholder={`${noun} 이름 입력`}
            aria-label={`${noun} 이름`}
            aria-autocomplete="list"
            aria-controls={`hints-${kind}`}
            className="rounded-full bg-surface"
          />
          {/* 자동완성: 입력칸 바로 아래에 최대 5개 — 위에 겹쳐 띄우지 않아 키보드·화면을 가리지 않음 */}
          {hints.length > 0 && (
            <ul id={`hints-${kind}`} role="listbox" aria-label={`${noun} 추천`} className="overflow-hidden rounded-2xl border border-border bg-surface">
              {hints.map((h) => (
                <li key={h} role="option" aria-selected={false}>
                  <button type="button" onClick={() => register(h)} className="flex min-h-11 w-full items-center px-4 text-left text-[15px] hover:bg-surface-muted">
                    {h}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <Button type="submit" variant="secondary" className="w-full rounded-full" disabled={!name.trim()}>
            등록하기
          </Button>
        </form>
      )}

      {mine.length === 0 ? (
        !adding && (
          <p className="rounded-2xl border border-dashed border-border px-4 py-6 text-center text-[13px] text-text-muted">
            등록한 {noun}이 없어요. [+ 등록]으로 추가하면 매일 {verb} 여부를 체크할 수 있어요.
          </p>
        )
      ) : (
        <ul className="space-y-2.5">
          {mine.map((item) => {
            const t = todayOf(item.id)
            const done = !!t && t.status !== 'skipped'
            const skipped = t?.status === 'skipped'
            return (
              <li key={item.id} className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-3">
                <button
                  type="button"
                  onClick={() => toggleTaken(item)}
                  aria-pressed={done}
                  aria-label={`${item.name} ${done ? `${verb} 취소` : `${verb} 완료`}`}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <AppIcon icon={kind === 'supplement' ? Pill : Tablets} size="md" bg="soft" className="size-11 shrink-0 rounded-xl" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[16px] font-semibold">{item.name}</span>
                    <span className={cn('block text-[13px]', done ? 'text-primary' : 'text-text-muted')}>
                      {done ? `오늘 ${verb} 완료 · ${formatTime(new Date(t!.at))}` : skipped ? '오늘 건너뛰었어요' : '아직 기록하지 않았어요'}
                    </span>
                  </span>
                  {done ? (
                    <AppIcon icon={CircleCheck} size="md" tone="success" />
                  ) : (
                    <span aria-hidden className="size-6 shrink-0 rounded-full border-2 border-border bg-surface-muted" />
                  )}
                </button>
                <div className="flex flex-col items-end gap-1">
                  <button
                    type="button"
                    onClick={() => openClock(item)}
                    aria-label={`${item.name} 알림 ${item.remindEnabled ? `${hourLabel(item.remindHour ?? 9)} 바꾸기` : '설정'}`}
                    className={cn('inline-flex h-7 items-center gap-1 rounded-full px-2 text-[12px]', item.remindEnabled ? 'bg-icon-soft text-icon' : 'text-text-subtle hover:bg-surface-muted')}
                  >
                    <BellRing size={13} strokeWidth={1.75} aria-hidden />
                    {item.remindEnabled ? hourLabel(item.remindHour ?? 9) : '알림'}
                  </button>
                  <div className="flex">
                    {!t && (
                      <button type="button" onClick={() => logItem(item.id, new Date().toISOString(), 'skipped')} className="h-7 rounded-full px-2 text-[12px] text-text-subtle hover:bg-surface-muted">
                        건너뛰기
                      </button>
                    )}
                    <button type="button" onClick={() => removeItem(item.id)} aria-label={`${item.name} 삭제`} className="inline-flex size-7 items-center justify-center rounded-full hover:bg-surface-muted">
                      <Trash2 size={14} strokeWidth={1.75} className="text-text-subtle" aria-hidden />
                    </button>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
      <p className="text-[12px] text-text-subtle">카드를 누르면 오늘 {verb} 완료로 바뀌고, 시간이 자동으로 저장돼요.</p>

      <BottomSheet open={!!clockFor} onRequestClose={() => setClockFor(null)} title="알림 시간" description={clockFor ? `${clockFor.name} · 매일` : undefined}>
        <div className="space-y-5">
          <HourClock hour={hour} onChange={setHour} />
          <div className="grid grid-cols-2 gap-2">
            {clockFor?.remindEnabled ? (
              <Button
                variant="outline"
                size="lg"
                onClick={() => {
                  setReminder(clockFor.id, { enabled: false, asked: true })
                  setClockFor(null)
                  toast('알림을 껐어요')
                }}
              >
                알림 끄기
              </Button>
            ) : (
              <Button variant="outline" size="lg" onClick={() => setClockFor(null)}>
                취소
              </Button>
            )}
            <Button size="lg" onClick={saveReminder}>
              저장
            </Button>
          </div>
        </div>
      </BottomSheet>
    </div>
  )
}

/** 케어 — 물 · 영양제 · 복용약 3탭 */
export function IntakeSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('water')
  const { items, setReminder } = useIntakeStore()
  // 이번에 새로 등록한 영양제·복용약 → 시트를 닫을 때 알림을 한 번만 제안
  const [fresh, setFresh] = useState<string[]>([])
  const [ask, setAsk] = useState(false)
  const [clock, setClock] = useState(false)
  const [hour, setHour] = useState(9)
  // 확인 버튼도 창을 닫으므로(onOpenChange false) '확인으로 닫힘'을 구분
  const confirming = useRef(false)
  // 저장되면 임시 id 가 실제 id 로 바뀌므로 '종류:이름'으로 찾는다
  const pending = items.filter((i) => fresh.includes(`${i.kind}:${i.name}`) && !i.remindAsked && !i.remindEnabled)
  const names = pending.map((i) => i.name)
  const finish = () => {
    setFresh([])
    setAsk(false)
    setClock(false)
    onClose()
  }
  const requestClose = () => (pending.length ? setAsk(true) : finish())
  const saveAll = async () => {
    for (const it of pending) setReminder(it.id, { enabled: true, hour, asked: true })
    finish()
    const r = await enablePush()
    if (r === 'subscribed') toast.success(`매일 ${hourLabel(hour)}에 알려드릴게요`)
    else toast(`매일 ${hourLabel(hour)}로 저장했어요`, { description: pushHint(r) })
  }
  return (
    <>
    <ConfirmDialog
      open={ask}
      onOpenChange={(o) => {
        if (o) return
        if (confirming.current) {
          confirming.current = false
          return
        }
        // 닫거나 '알림받지 않기' → 이번에 등록한 것들은 다시 묻지 않음
        for (const it of pending) setReminder(it.id, { asked: true })
        finish()
      }}
      title="매일 알림을 보내드릴게요"
      description={`${names.length > 1 ? `${names[0]} 외 ${names.length - 1}개` : (names[0] ?? '')} 먹을 시간에 알려드려요. 시간은 다음 화면에서 정해요.`}
      confirmLabel="확인"
      cancelLabel="알림받지 않기"
      onConfirm={() => {
        confirming.current = true
        setAsk(false)
        setHour(new Date().getHours())
        setClock(true)
      }}
    />
    <BottomSheet open={clock} onRequestClose={finish} title="알림 시간" description={`${names.join(' · ')} · 매일`}>
      <div className="space-y-5">
        <HourClock hour={hour} onChange={setHour} />
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            size="lg"
            onClick={() => {
              for (const it of pending) setReminder(it.id, { asked: true })
              finish()
            }}
          >
            취소
          </Button>
          <Button size="lg" onClick={saveAll}>
            저장
          </Button>
        </div>
      </div>
    </BottomSheet>
    <BottomSheet
      open={open && !ask && !clock}
      onRequestClose={requestClose}
      title="케어"
      description="실제로 마시고 먹은 것만 기록해요"
    >
      <div className="sticky -top-4 z-10 -mx-5 -mt-4 bg-surface px-5 pt-1 pb-4 md:-mx-6 md:px-6">
        <div role="tablist" aria-label="케어 종류" className="grid grid-cols-3 gap-1 rounded-2xl bg-surface-muted p-1">
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
        {tab === 'water' ? <WaterTab /> : <ItemTab key={tab} kind={tab} onRegistered={(k) => setFresh((f) => [...f, k])} />}
      </div>
    </BottomSheet>
    </>
  )
}
