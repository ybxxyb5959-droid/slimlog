import { CalendarDays, ChevronRight, CircleCheck } from 'lucide-react'
import { Link } from 'react-router'

import { RECORD_MENUS } from '@/app/navigation'
import { MockBadge } from '@/components/common/MockBadge'
import { toDateKey } from '@/lib/date'
import { cn } from '@/lib/utils'
import { useDoses } from '@/services/doses'
import { isNewUser } from '@/services/session'
import { summarizeIntake, useIntakeStore } from '@/stores/intakeStore'
import { useMealStore } from '@/stores/mealStore'
import { useRecordsStore } from '@/stores/recordsStore'

/** 자주 쓰는 기록 (2×2) — 오늘 완료 개수는 이 4개 기준 */
const FREQUENT = [
  { to: '/record/medication', description: '약 · 용량 · 부위' },
  { to: '/record/meal', description: '사진으로 기록' },
  { to: '/record/body', description: '체중 입력' },
  { to: '/record/daily', description: '물 · 영양제 · 복용약' },
] as const
/** 추가 기록 (목록) */
const MORE = [
  { to: '/record/inbody', description: '결과지 촬영 및 입력' },
  { to: '/record/eyebody', description: '내 기기에 사진 저장' },
  { to: '/record/symptom', description: '몸 상태 기록' },
] as const

const menu = (to: string) => RECORD_MENUS.find((m) => m.to === to)!

/** 목업 예시 사용자의 오늘 기록 여부 */
const EXAMPLE_DONE: Record<string, boolean> = {
  '/record/medication': false,
  '/record/meal': false,
  '/record/body': true,
  '/record/daily': true,
  '/record/symptom': false,
}

const isToday = (iso: string) => toDateKey(new Date(iso)) === toDateKey(new Date())

/** 실제 기록 기준 오늘 완료 여부 (실서비스·목업 새 사용자) */
function useTodayDone(): Record<string, boolean> {
  const doses = useDoses()
  const meals = useMealStore((s) => s.records)
  const water = useIntakeStore((s) => s.water)
  const intakeLogs = useIntakeStore((s) => s.logs)
  const { bodyLogs, symptoms, daily } = useRecordsStore()
  if (!isNewUser()) return EXAMPLE_DONE
  return {
    '/record/medication': doses.some((d) => isToday(d.administeredAt)),
    '/record/meal': meals.some((m) => isToday(m.eatenAt)),
    '/record/body': bodyLogs.some((b) => isToday(b.measuredAt)),
    '/record/daily': summarizeIntake({ water, logs: intakeLogs }).ml > 0 || intakeLogs.some((l) => isToday(l.at)),
    '/record/symptom': symptoms.some((x) => isToday(x.recordedAt)) || daily.some((d) => d.date === toDateKey(new Date())),
  }
}

export function RecordHubPage() {
  const done = useTodayDone()
  const count = FREQUENT.filter((f) => done[f.to]).length
  return (
    <div className="space-y-4 md:max-w-2xl">
      {/* 요약 */}
      <section aria-labelledby="record-title" className="rounded-card border border-border bg-surface px-5 py-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 id="record-title" className="text-[26px] font-bold tracking-tight">
              기록
            </h1>
            <p className="mt-0.5 text-[14px] text-text-muted">오늘의 변화를 기록해 보세요.</p>
          </div>
          <div className="flex items-center gap-1">
            {!isNewUser() && <MockBadge />}
            <Link to="/analysis/timeline" aria-label="날짜별 기록 보기" className="inline-flex size-11 items-center justify-center rounded-full text-text-muted hover:bg-surface-muted">
              <CalendarDays size={22} strokeWidth={1.75} aria-hidden />
            </Link>
          </div>
        </div>
        <div className="mt-3 flex items-end justify-between gap-3">
          <div>
            <p className="text-[12px] font-medium text-text-muted">오늘의 기록</p>
            <p className="tabular">
              <span className="text-[28px] leading-none font-bold">
                {count}/{FREQUENT.length}
              </span>
              <span className="ml-1 text-[14px] font-medium text-text-muted">개 완료</span>
            </p>
          </div>
          <div className="flex gap-1.5 pb-1.5" role="progressbar" aria-label="오늘 기록 진행" aria-valuemin={0} aria-valuemax={FREQUENT.length} aria-valuenow={count}>
            {FREQUENT.map((f, i) => (
              <span key={f.to} className={cn('h-1.5 w-7 rounded-full', i < count ? 'bg-primary' : 'bg-border')} />
            ))}
          </div>
        </div>
      </section>

      {/* 자주 쓰는 기록 */}
      <section aria-labelledby="frequent-title" className="rounded-card border border-border bg-surface px-4 py-4">
        <div className="mb-3 flex items-baseline justify-between px-1">
          <h2 id="frequent-title" className="text-[16px] font-bold">
            자주 쓰는 기록
          </h2>
          <span className="text-[12px] text-text-muted">빠른 기록</span>
        </div>
        <ul className="grid grid-cols-2 gap-2.5">
          {FREQUENT.map((f) => {
            const m = menu(f.to)
            const isDone = done[f.to]
            return (
              <li key={f.to}>
                <Link
                  to={f.to}
                  aria-label={`${m.label}${isDone ? ', 오늘 기록 완료' : ''}`}
                  className="flex h-full min-h-[124px] flex-col rounded-2xl border border-border bg-surface p-4 transition-colors hover:bg-surface-muted/60"
                >
                  <div className="flex items-start justify-between">
                    <span aria-hidden className="inline-flex size-11 items-center justify-center rounded-xl bg-icon-soft text-icon">
                      <m.icon size={22} strokeWidth={1.75} />
                    </span>
                    {isDone && <CircleCheck size={20} strokeWidth={1.9} aria-hidden className="text-primary" />}
                  </div>
                  <span className="mt-auto pt-3 text-[15px] font-bold">{m.label}</span>
                  <span className={cn('text-[12px]', isDone ? 'text-primary' : 'text-text-muted')}>{isDone ? '오늘 기록 완료' : f.description}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      </section>

      {/* 추가 기록 */}
      <section aria-labelledby="more-title" className="rounded-card border border-border bg-surface px-4 pt-4 pb-1">
        <h2 id="more-title" className="mb-1 px-1 text-[16px] font-bold">
          추가 기록
        </h2>
        <ul className="divide-y divide-border">
          {MORE.map((f) => {
            const m = menu(f.to)
            const isDone = done[f.to]
            return (
              <li key={f.to}>
                <Link to={f.to} aria-label={`${m.label}${isDone ? ', 오늘 기록 완료' : ''}`} className="flex min-h-[72px] items-center gap-3 px-1 py-3">
                  <span aria-hidden className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-icon-soft text-icon">
                    <m.icon size={22} strokeWidth={1.75} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-bold">{m.label}</span>
                    <span className={cn('block text-[12px]', isDone ? 'text-primary' : 'text-text-muted')}>{isDone ? '오늘 기록 완료' : f.description}</span>
                  </span>
                  <ChevronRight size={20} aria-hidden className="text-text-subtle" />
                </Link>
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}
