import { MockBadge } from '@/components/common/MockBadge'
import { PageHeader } from '@/components/common/PageHeader'
import { WEIGHT_ANALOGIES } from '@/fixtures/weightAnalogies'

import { WeightAnalogyCard } from '../home/WeightAnalogyCard'

/** 디자인 검토용: 감량량별 체중 비유 카드 상태 모음 (메뉴에 노출하지 않음) */
const CASES = [
  { label: '체중 증가', start: 80, latest: 80.4 },
  { label: '변화 거의 없음', start: 80, latest: 79.9 },
  { label: '-0.4kg', start: 80, latest: 79.6 },
  { label: '-0.9kg', start: 80, latest: 79.1 },
  { label: '-1.98kg', start: 80, latest: 78.02 },
  { label: '-3.2kg', start: 80, latest: 76.8 },
  { label: '-5.4kg', start: 90, latest: 84.6 },
  { label: '-9.0kg', start: 90, latest: 81 },
  { label: '-16kg', start: 96, latest: 80 },
]

export function WeightCardGallery() {
  return (
    <>
      <PageHeader title="체중 비유 카드" description={`비유 ${WEIGHT_ANALOGIES.length}종 + 중립 상태 · 검토용 화면`} back="/home" actions={<MockBadge />} />
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {CASES.map((c) => (
          <li key={c.label}>
            <p className="mb-1.5 text-[12px] font-semibold text-text-subtle">{c.label}</p>
            <div>
              <WeightAnalogyCard startKg={c.start} latestKg={c.latest} />
            </div>
          </li>
        ))}
      </ul>
    </>
  )
}
