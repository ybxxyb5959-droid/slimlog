import { ClipboardPen, ScanText } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'

import { BodyCompositionChart } from '@/components/charts/BodyCompositionChart'
import { AppIcon } from '@/components/common/AppIcon'
import { MockBadge } from '@/components/common/MockBadge'
import { Card } from '@/components/ui/card'
import { formatFullDate } from '@/lib/date'
import { cn } from '@/lib/utils'
import type { BodyLog } from '@/types/domain'

/** 인바디 항목 정의 — 항목을 늘릴 때 여기만 추가 (내장지방 레벨·체수분 등은 데이터 구조 확장 후) */
const METRICS = [
  { key: 'skeletalMuscleKg', label: '골격근량', unit: 'kg' },
  { key: 'bodyFatKg', label: '체지방량', unit: 'kg' },
  { key: 'bodyFatPct', label: '체지방률', unit: '%' },
  { key: 'weightKg', label: '체중', unit: 'kg' },
] as const

const hasComposition = (l: BodyLog) => l.skeletalMuscleKg !== undefined || l.bodyFatKg !== undefined || l.bodyFatPct !== undefined

function Delta({ now, prev, unit }: { now?: number; prev?: number; unit: string }) {
  if (now === undefined || prev === undefined) return null
  const d = Math.round((now - prev) * 10) / 10
  return (
    <span className="tabular text-[13px] text-text-muted">
      이전 대비 {d > 0 ? '+' : d < 0 ? '−' : '±'}
      {Math.abs(d).toFixed(1)}
      {unit}
    </span>
  )
}

function MetricGrid({ log, prev }: { log: BodyLog; prev?: BodyLog }) {
  return (
    <dl className="grid grid-cols-2 gap-2.5">
      {METRICS.map((m) => {
        const v = log[m.key]
        return (
          <div key={m.key} className="rounded-2xl bg-surface-muted px-4 py-3.5">
            <dt className="text-[13px] text-text-muted">{m.label}</dt>
            <dd className="tabular mt-0.5 text-[24px] leading-tight font-bold">
              {v !== undefined ? (
                <>
                  {v}
                  <span className="ml-0.5 text-[14px] font-semibold text-text-muted">{m.unit}</span>
                </>
              ) : (
                <span className="text-[16px] text-text-subtle">기록 없음</span>
              )}
            </dd>
            {prev && <Delta now={v} prev={prev[m.key]} unit={m.unit} />}
          </div>
        )
      })}
    </dl>
  )
}

function EmptyInbody() {
  return (
    <Card className="flex flex-col items-center px-6 py-10 text-center">
      <AppIcon icon={ScanText} size="lg" bg="success" tone="success" className="size-16 rounded-full [&>svg]:size-7" />
      <p className="mt-4 text-[18px] font-bold">첫 인바디 기록을 남겨 보세요</p>
      <p className="mt-1.5 max-w-xs text-[14px] leading-relaxed break-keep text-text-muted">
        결과지를 등록하면 골격근량과 체지방량의 변화를 비교할 수 있어요.
      </p>
      <div className="mt-6 grid w-full max-w-sm gap-2">
        <Link to="/record/inbody" className="flex h-12 items-center justify-center gap-2 rounded-xl border border-border bg-surface text-[15px] font-semibold hover:bg-surface-muted">
          <AppIcon icon={ScanText} size="sm" /> 결과지 사진으로 등록
        </Link>
        <Link to="/record/body" className="flex h-12 items-center justify-center gap-2 rounded-xl border border-border bg-surface text-[15px] font-semibold hover:bg-surface-muted">
          <AppIcon icon={ClipboardPen} size="sm" /> 수치 직접 입력
        </Link>
      </div>
      <p className="mt-4 text-[12px] text-text-subtle">결과지 사진이나 인바디 앱 화면 캡처를 올리면 숫자를 읽어 채워 줘요. 읽은 숫자는 확인한 뒤 저장돼요.</p>
    </Card>
  )
}

type Preview = 'auto' | 'empty' | 'one'

/** 인바디 변화 — 최근 2회 비교 + 전체 추이 */
export function InbodyTab({ logs, isExample }: { logs: BodyLog[]; isExample: boolean }) {
  const [preview, setPreview] = useState<Preview>('auto')
  const all = logs.filter(hasComposition).sort((a, b) => a.measuredAt.localeCompare(b.measuredAt))
  const records = preview === 'empty' ? [] : preview === 'one' ? all.slice(-1) : all
  const latest = records.at(-1)
  const prev = records.at(-2)

  return (
    <div className="space-y-4">
      {isExample && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <MockBadge label="예시 데이터 · 실제 기록 아님" />
          <div role="radiogroup" aria-label="상태 미리보기 (목업)" className="inline-flex rounded-lg bg-surface-muted p-0.5 text-[12px]">
            {(
              [
                ['auto', '여러 회'],
                ['one', '1회'],
                ['empty', '기록 없음'],
              ] as const
            ).map(([v, l]) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={preview === v}
                onClick={() => setPreview(v)}
                className={cn('h-8 rounded-md px-2.5 font-medium', preview === v ? 'bg-surface text-text shadow-sm' : 'text-text-muted')}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
      )}

      {!latest ? (
        <EmptyInbody />
      ) : (
        <>
          <Card>
            <div className="mb-3 flex items-baseline justify-between gap-2">
              <h2 className="text-[17px] font-bold">{prev ? '최근 2회 비교' : '측정 결과'}</h2>
              <span className="tabular text-[12px] text-text-muted">
                {prev ? `${formatFullDate(new Date(prev.measuredAt))} → ` : ''}
                {formatFullDate(new Date(latest.measuredAt))}
              </span>
            </div>
            <MetricGrid log={latest} prev={prev} />
            {!prev && <p className="mt-3 text-[13px] text-text-muted">한 번 더 측정하면 이전 결과와 비교하고 추이를 보여드려요.</p>}
          </Card>

          {records.length >= 2 && (
            <Card>
              <h2 className="text-[17px] font-bold">전체 추이</h2>
              <p className="mt-0.5 text-[13px] text-text-muted">측정 {records.length}회</p>
              <div className="mt-3">
                <BodyCompositionChart logs={records} />
              </div>
            </Card>
          )}
          <p className="px-1 text-[12px] leading-relaxed text-text-subtle">
            측정 시간·식사·기기에 따라 수치가 달라질 수 있어요. 결과는 기록을 비교하기 위한 것이며 건강 상태를 판단하지 않아요.
          </p>
        </>
      )}
    </div>
  )
}
