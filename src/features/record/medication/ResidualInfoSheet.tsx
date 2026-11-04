import { curveTmaxHours } from '@/fixtures/medications.mock'
import { ExternalLink } from 'lucide-react'

import { BottomSheet } from '@/components/common/BottomSheet'
import { RESIDUAL_DISCLAIMER } from '@/components/common/Notice'
import { Button } from '@/components/ui/button'
import type { ApprovalSource, Medication } from '@/types/domain'

function Src({ source }: { source: ApprovalSource }) {
  return (
    <a href={source.url} target="_blank" rel="noreferrer" className="text-[12px] text-text-subtle underline decoration-dotted underline-offset-2 hover:text-text-muted">
      {source.title}
      <ExternalLink size={11} strokeWidth={1.75} className="ml-0.5 inline align-[-1px]" aria-hidden />
      <span className="no-underline"> · {source.checkedAt} 확인{source.status === 'secondary' && ' · 원문 대조 필요'}</span>
    </a>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-[15px] font-bold text-text">{title}</h3>
      <div className="space-y-2 text-[14px] leading-relaxed text-text-muted">{children}</div>
    </section>
  )
}

/** 참고 곡선 상세 설명 — 그래프의 ⓘ 버튼으로 연다 */
export function ResidualInfoSheet({ open, onClose, medication }: { open: boolean; onClose: () => void; medication: Medication }) {
  const pk = medication.pk
  const tmax = curveTmaxHours(medication)
  const rows: { label: string; value: string; use: string; source?: ApprovalSource }[] = [
    { label: '제거 반감기', value: pk.halfLifeHours?.text ?? '확인 못 함', use: pk.halfLifeHours ? '계산에 사용' : '곡선 미생성', source: pk.halfLifeHours?.source },
    { label: '생체이용률', value: pk.bioavailability?.text ?? '확인 못 함', use: '검토만 · 미사용', source: pk.bioavailability?.source },
    { label: '최고농도 도달', value: pk.tmaxHours?.text ?? '확인 못 함', use: tmax ? `대표값 ${tmax}시간 사용` : '미사용', source: pk.tmaxHours?.source },
    { label: '흡수 속도(ka)', value: pk.absorptionRateKa?.text ?? '허가자료에 없음', use: tmax ? '대표 tmax 로 역산' : '흡수 모델 비활성' },
  ]

  return (
    <BottomSheet
      open={open}
      onRequestClose={onClose}
      title="참고용 잔존량 계산 안내"
      description={`${medication.name} · 흡수·반감기 기반 상대값`}
      footer={
        <Button size="lg" className="w-full" onClick={onClose}>
          닫기
        </Button>
      }
    >
      <div className="space-y-6">
        <Section title="계산 방식">
          <p>
            맞은 뒤 약이 천천히 흡수돼 {tmax ? `약 ${tmax}시간` : '며칠'} 뒤 가장 높아지고, 그다음 반감기만큼 시간이 지날 때마다 절반으로 줄어드는 모양(1차 흡수 모델)으로 계산해요.
            이전 투여분과 새 투여분을 모두 더해요.
          </p>
          <p>그래프는 표시 기간 중 가장 높은 시점을 100%로 둔 상대값이에요. 선택한 약의 기록만 계산해요.</p>
        </Section>

        <Section title={`사용한 파라미터 · ${medication.name}`}>
          <dl className="divide-y divide-border overflow-hidden rounded-2xl border border-border">
            {rows.map((r) => (
              <div key={r.label} className="space-y-1 px-4 py-3">
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-[13px] text-text-muted">{r.label}</dt>
                  <dd className="text-right text-[14px] font-semibold text-text">
                    {r.value} <span className="ml-1 text-[12px] font-medium text-text-subtle">{r.use}</span>
                  </dd>
                </div>
                {r.source && <Src source={r.source} />}
              </div>
            ))}
          </dl>
          <p className="text-[13px]">약마다 파라미터를 따로 쓰며 다른 약의 값을 섞지 않아요.</p>
        </Section>

        <Section title="mg으로 표시하지 않는 이유">
          <p>
            체내에 남은 양을 mg으로 추정하려면 흡수 속도(ka)가 필요한데, 허가자료에는 최고농도 도달 시간의 넓은 범위만 있고 ka 값은 없어요.
            이 범위 안에서 ka를 고르는 방식에 따라 최고점 시각과 높이가 크게 달라져서, 검증 전까지 mg 표시는 꺼 두었어요.
          </p>
        </Section>

        <Section title="계산의 한계">
          <ul className="list-disc space-y-1 pl-5">
            <li>흡수 속도는 허가자료의 최고농도 도달 시간 범위 중간값으로 근사했어요. 실제로는 사람마다 더 빠르거나 느릴 수 있어요.</li>
            {medication.id === 'efpe' && <li>에O는 단회 투여 값이 없어 반복 투여(항정상태) 중앙값 48시간을 썼어요.</li>}
            <li>체중, 주사 부위, 개인차, 놓친 투약은 반영하지 않아요.</li>
            <li>입력한 기록이 틀리거나 빠지면 곡선도 달라져요.</li>
          </ul>
        </Section>

        <Section title="실제 혈중농도와의 차이">
          <p>혈액검사로 잰 농도가 아니고 체내 잔존량을 직접 측정한 값도 아니에요. 단위가 없는 상대값이라 다른 사람이나 다른 약과 비교할 수 없어요.</p>
        </Section>

        <Section title="이 그래프로 할 수 없는 것">
          <ul className="list-disc space-y-1 pl-5">
            <li>약효나 부작용의 강도를 예측할 수 없어요.</li>
            <li>투약 용량이나 일정을 정하는 데 쓰면 안 돼요. 용량 변경은 의료진의 안내를 따라 주세요.</li>
          </ul>
        </Section>

        <p className="rounded-xl bg-surface-muted px-4 py-3 text-[13px] text-text-muted">{RESIDUAL_DISCLAIMER}</p>
      </div>
    </BottomSheet>
  )
}
