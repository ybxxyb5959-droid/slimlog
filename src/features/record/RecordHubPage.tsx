import { RECORD_MENUS } from '@/app/navigation'
import { MenuTile } from '@/components/common/MenuTile'
import { MockBadge } from '@/components/common/MockBadge'
import { PageHeader } from '@/components/common/PageHeader'
import { Badge } from '@/components/ui/badge'
import { toDateKey } from '@/lib/date'
import { isNewUser } from '@/services/session'
import { summarizeIntake, useIntakeStore } from '@/stores/intakeStore'
import { useMealStore } from '@/stores/mealStore'
import { useRecordsStore } from '@/stores/recordsStore'

/** 목업 예시 사용자의 오늘 기록 여부 */
const EXAMPLE_DONE: Record<string, boolean> = {
  '/record/meal': true,
  '/record/daily': true,
  '/record/symptom': false,
  '/record/body': false,
}

const isToday = (iso: string) => toDateKey(new Date(iso)) === toDateKey(new Date())

/** 실제 기록 기준 오늘 완료 여부 (실서비스·목업 새 사용자) */
function useTodayDone(): Record<string, boolean> {
  const meals = useMealStore((s) => s.records)
  const water = useIntakeStore((s) => s.water)
  const intakeLogs = useIntakeStore((s) => s.logs)
  const { bodyLogs, symptoms, daily } = useRecordsStore()
  if (!isNewUser()) return EXAMPLE_DONE
  return {
    '/record/meal': meals.some((m) => isToday(m.eatenAt)),
    '/record/daily': summarizeIntake({ water, logs: intakeLogs }).ml > 0 || intakeLogs.some((l) => isToday(l.at)),
    '/record/symptom': symptoms.some((x) => isToday(x.recordedAt)) || daily.some((d) => d.date === toDateKey(new Date())),
    '/record/body': bodyLogs.some((b) => isToday(b.measuredAt)),
  }
}

export function RecordHubPage() {
  const TODAY_DONE = useTodayDone()
  const done = Object.values(TODAY_DONE).filter(Boolean).length
  return (
    <>
      <PageHeader title="기록" description="오늘 기록할 항목을 골라주세요." />
      <div className="mb-5 flex items-center justify-between gap-3 rounded-card bg-primary-soft px-5 py-4">
        <div>
          <p className="text-[13px] font-medium text-primary">오늘 기록</p>
          <p className="tabular text-[20px] font-bold text-text">
            {done} <span className="text-[14px] font-medium text-text-muted">/ {Object.keys(TODAY_DONE).length}개 항목</span>
          </p>
        </div>
        {!isNewUser() && <MockBadge />}
      </div>
      <ul className="grid gap-2.5 md:grid-cols-2">
        {RECORD_MENUS.map((m) => (
          <li key={m.to}>
            <MenuTile
              to={m.to}
              icon={m.icon}
              title={m.label}
              description={m.description}
              meta={TODAY_DONE[m.to] ? <Badge tone="success">오늘 완료</Badge> : undefined}
            />
          </li>
        ))}
      </ul>
    </>
  )
}
