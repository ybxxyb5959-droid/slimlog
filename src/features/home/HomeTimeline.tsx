import { Syringe } from 'lucide-react'

import { AppIcon } from '@/components/common/AppIcon'
import { MEDICATIONS } from '@/fixtures/medications.mock'
import { formatShortDate } from '@/lib/date'
import { cn } from '@/lib/utils'
import type { TimelineDay } from '@/types/domain'

/** 최근 7일 통합 타임라인 — 막대=섭취 kcal, 주사 아이콘=투약, 점=증상 개수 */
export function HomeTimeline({ days }: { days: TimelineDay[] }) {
  const maxKcal = Math.max(...days.map((d) => d.kcal ?? 0), 1)
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-text-muted">
        <span className="inline-flex items-center gap-1.5">
          <AppIcon icon={Syringe} size="sm" className="size-4" /> 투약
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-2 rounded-sm bg-primary/35" /> 섭취 kcal
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-text-muted" /> 증상(개수)
        </span>
      </div>
      <ol className="grid grid-cols-7 gap-1 sm:gap-2" aria-label="최근 7일 기록">
        {days.map((d, i) => {
          const date = new Date(d.date + 'T00:00:00')
          const isToday = i === days.length - 1
          const h = d.kcal ? Math.max(12, Math.round((d.kcal / maxKcal) * 100)) : 0
          const dose = d.doses[0]
          const desc = [
            dose ? `${MEDICATIONS[dose.medicationId].name} ${dose.doseMg}mg 투약` : null,
            d.kcal ? `섭취 ${d.kcal.toLocaleString()}kcal` : '식단 기록 없음',
            d.symptomCount ? `증상 ${d.symptomCount}개` : null,
          ]
            .filter(Boolean)
            .join(', ')
          return (
            <li key={d.date} className="flex flex-col items-center" title={desc} aria-label={`${formatShortDate(date)}: ${desc}`}>
              <div className="flex h-6 items-end">{dose && <AppIcon icon={Syringe} size="sm" className="size-[18px]" />}</div>
              <div className="flex h-24 w-full items-end justify-center">
                <div
                  className={cn('w-full max-w-7 rounded-t-[4px] rounded-b-[2px]', isToday ? 'bg-primary/60' : 'bg-primary/30')}
                  style={{ height: `${h}%` }}
                />
              </div>
              <div className="mt-1.5 flex h-2 items-center gap-0.5">
                {Array.from({ length: Math.min(d.symptomCount, 3) }).map((_, k) => (
                  <span key={k} className="size-1.5 rounded-full bg-text-muted" />
                ))}
              </div>
              <span className={cn('tabular mt-1 text-[11px]', isToday ? 'font-bold text-text' : 'text-text-subtle')}>
                {isToday ? '오늘' : formatShortDate(date)}
              </span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
