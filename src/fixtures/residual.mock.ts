import type { Dose, Medication, ResidualPoint } from '@/types/domain'

/**
 * [예시 데이터 생성 전용 — 실제 계산 엔진 아님]
 * 화면 확인을 위해 계획서 6.3의 방식(용량 × (1/2)^(경과/반감기) 합산, 기간 최댓값 = 100)으로
 * 예시 곡선 점을 만든다. 실제 계산은 서버(GET /residual-curve)가 담당한다.
 * 반감기 출처가 없는 약은 빈 배열을 돌려준다 → 화면은 "곡선 미생성" 상태.
 */
export function buildExampleResidualCurve(
  doses: Dose[],
  medication: Medication,
  from: number,
  to: number,
  stepHours = 24,
): ResidualPoint[] {
  if (!medication.halfLifeHours || !medication.halfLifeSource) return []
  const hl = medication.halfLifeHours * 3600 * 1000
  const own = doses.filter((d) => d.medicationId === medication.id).map((d) => ({ t: new Date(d.administeredAt).getTime(), mg: d.doseMg }))
  const step = stepHours * 3600 * 1000
  const raw: { t: number; v: number }[] = []
  for (let t = from; t <= to; t += step) {
    const v = own.filter((d) => d.t <= t).reduce((sum, d) => sum + d.mg * Math.pow(0.5, (t - d.t) / hl), 0)
    raw.push({ t, v })
  }
  const max = Math.max(...raw.map((p) => p.v), 0)
  if (max === 0) return []
  return raw.map((p) => ({ t: p.t, relative: Math.round((p.v / max) * 1000) / 10 }))
}
