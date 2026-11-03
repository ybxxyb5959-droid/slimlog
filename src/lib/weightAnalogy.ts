import { ANALOGY_MIN_LOSS_KG, WEIGHT_ANALOGIES, type WeightAnalogy } from '@/fixtures/weightAnalogies'

export type WeightSummary =
  | { kind: 'loss'; lossKg: number; analogy: WeightAnalogy; /** 가장 큰 비유보다 많이 빠짐 */ beyond: boolean }
  | { kind: 'neutral'; diffKg: number }

/** 시작 체중 대비 최근 체중 차이로 비유를 고른다 (소수 첫째 자리 기준) */
export function summarizeWeightChange(startKg: number, latestKg: number): WeightSummary {
  const diff = Math.round((latestKg - startKg) * 100) / 100
  const loss = -diff
  if (loss < ANALOGY_MIN_LOSS_KG) return { kind: 'neutral', diffKg: diff }
  const sorted = [...WEIGHT_ANALOGIES].sort((a, b) => a.minKg - b.minKg)
  const analogy = sorted.filter((a) => loss >= a.minKg).at(-1) ?? sorted[0]
  const last = sorted[sorted.length - 1]
  return { kind: 'loss', lossKg: loss, analogy, beyond: analogy === last && loss >= last.approxKg * 1.5 }
}

export function formatKg(kg: number, digits = 1) {
  return kg.toFixed(digits).replace(/\.0+$/, (m) => (digits > 0 ? m : ''))
}
