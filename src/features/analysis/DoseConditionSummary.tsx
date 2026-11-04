import { Activity, CalendarClock, ChevronRight, Syringe } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'

import { AppIcon } from '@/components/common/AppIcon'
import { Card } from '@/components/ui/card'
import { MEDICATIONS, siteLabel } from '@/fixtures/medications.mock'
import { SYMPTOM_LABEL } from '@/fixtures/records.mock'
import { addDays, formatShortDateWithDay, startOfDay, toDateKey } from '@/lib/date'
import { useDoses } from '@/services/doses'
import { useSymptoms } from '@/services/symptoms'
import { useRecordsStore } from '@/stores/recordsStore'
import type { SymptomType } from '@/types/domain'

/**
 * 분석 > 체내 용량 아래 기본 카드 — 주사 기록 + 최근 7일 컨디션 요약
 * 다음 예정일은 지난 투약 + 7일 (기록 기반 표시, 투약 일정을 권유하지 않음)
 */
export function DoseConditionSummary() {
  const doses = useDoses()
  const symptoms = useSymptoms()
  const daily = useRecordsStore((s) => s.daily)
  const [now] = useState(() => Date.now())
  const weekAgo = now - 7 * 86_400_000
  const monthAgo = now - 28 * 86_400_000

  const last = doses[0]
  const nextDate = last ? addDays(startOfDay(new Date(last.administeredAt)), 7) : null
  const daysToNext = nextDate ? Math.round((nextDate.getTime() - startOfDay(new Date(now)).getTime()) / 86_400_000) : null
  const doses4w = doses.filter((d) => new Date(d.administeredAt).getTime() >= monthAgo).length

  const weekKeys = new Set(Array.from({ length: 7 }, (_, i) => toDateKey(new Date(now - i * 86_400_000))))
  const conds = daily.filter((d) => weekKeys.has(d.date)).map((d) => d.condition).filter((c): c is NonNullable<typeof c> => c != null)
  const condAvg = conds.length ? Math.round((conds.reduce((a, b) => a + b, 0) / conds.length) * 10) / 10 : null
  const sym7 = symptoms.filter((s) => new Date(s.recordedAt).getTime() >= weekAgo)
  const topSym = (() => {
    const c = new Map<string, number>()
    for (const s of sym7) c.set(s.type, (c.get(s.type) ?? 0) + 1)
    const top = [...c.entries()].sort((a, b) => b[1] - a[1])[0]
    return top ? { label: SYMPTOM_LABEL[top[0] as SymptomType] ?? top[0], n: top[1] } : null
  })()

  return (
    <Card className="mt-3 space-y-4" aria-labelledby="dose-cond-title">
      <div className="flex items-center justify-between">
        <h2 id="dose-cond-title" className="text-[16px] font-bold">
          주사 · 컨디션 요약
        </h2>
        <Link to="/analysis/timeline" className="inline-flex h-9 items-center gap-0.5 text-[13px] font-medium text-text-muted hover:text-text">
          날짜별 보기 <ChevronRight size={16} aria-hidden />
        </Link>
      </div>

      {/* 주사 기록 */}
      <section aria-label="주사 기록" className="grid grid-cols-2 gap-2">
        <div className="rounded-2xl bg-surface-muted p-3">
          <p className="flex items-center gap-1.5 text-[12px] font-medium text-text-muted">
            <AppIcon icon={Syringe} size="sm" className="size-4" /> 마지막 투약
          </p>
          {last ? (
            <>
              <p className="mt-1 text-[15px] font-bold text-text">
                {MEDICATIONS[last.medicationId]?.name} {last.doseMg}mg
              </p>
              <p className="tabular text-[12px] text-text-muted">
                {formatShortDateWithDay(new Date(last.administeredAt))} · {siteLabel(last.site)}
              </p>
            </>
          ) : (
            <p className="mt-1 text-[13px] text-text-subtle">아직 기록이 없어요</p>
          )}
        </div>
        <div className="rounded-2xl bg-surface-muted p-3">
          <p className="flex items-center gap-1.5 text-[12px] font-medium text-text-muted">
            <AppIcon icon={CalendarClock} size="sm" className="size-4" /> 다음 예정
          </p>
          {nextDate && daysToNext !== null ? (
            <>
              <p className="mt-1 text-[15px] font-bold text-text">{daysToNext > 0 ? `${daysToNext}일 뒤` : daysToNext === 0 ? '오늘' : `${-daysToNext}일 지남`}</p>
              <p className="tabular text-[12px] text-text-muted">
                {formatShortDateWithDay(nextDate)} · 최근 4주 {doses4w}회
              </p>
            </>
          ) : (
            <p className="mt-1 text-[13px] text-text-subtle">투약을 기록하면 보여요</p>
          )}
        </div>
      </section>

      {/* 컨디션 */}
      <section aria-label="최근 7일 컨디션" className="rounded-2xl bg-surface-muted p-3">
        <p className="flex items-center gap-1.5 text-[12px] font-medium text-text-muted">
          <AppIcon icon={Activity} size="sm" className="size-4" /> 최근 7일 컨디션
        </p>
        <div className="mt-2 grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="tabular text-[18px] font-bold text-text">{condAvg !== null ? condAvg : '—'}</p>
            <p className="text-[11px] text-text-muted">평균 컨디션 /5</p>
          </div>
          <div>
            <p className="tabular text-[18px] font-bold text-text">{sym7.length}건</p>
            <p className="text-[11px] text-text-muted">부작용 기록</p>
          </div>
          <div>
            <p className="truncate text-[15px] leading-[27px] font-bold text-text">{topSym ? topSym.label : '—'}</p>
            <p className="text-[11px] text-text-muted">가장 많았던 증상</p>
          </div>
        </div>
      </section>
      <Link to="/record/symptom" className="flex h-11 items-center justify-center gap-1 rounded-xl border border-border text-[14px] font-medium hover:bg-surface-muted">
        오늘 컨디션 · 부작용 기록하기 <ChevronRight size={16} aria-hidden />
      </Link>
    </Card>
  )
}
