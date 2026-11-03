import { RECORD_MENUS } from '@/app/navigation'
import { MenuTile } from '@/components/common/MenuTile'
import { MockBadge } from '@/components/common/MockBadge'
import { PageHeader } from '@/components/common/PageHeader'
import { Badge } from '@/components/ui/badge'

/** 오늘 기록 여부 (예시) */
const TODAY_DONE: Record<string, boolean> = {
  '/record/meal': true,
  '/record/daily': true,
  '/record/symptom': false,
  '/record/body': false,
}

export function RecordHubPage() {
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
        <MockBadge />
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
