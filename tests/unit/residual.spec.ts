import { expect, test } from '@playwright/test'

import {
  batemanAmount,
  batemanSum,
  exponentialSum,
  kaFromTmax,
  LN2,
  relativeCurve,
  sampleTimes,
  tmaxFromRates,
  type DoseEvent,
} from '../../src/lib/pk/residual'

const H = 3600 * 1000
const T0 = Date.UTC(2026, 9, 1, 12)
const MOUNJARO_T12 = 5 * 24 // 라벨: 약 5일
const WEGOVY_T12 = 7 * 24 // 라벨: 약 1주

test.describe('모델 A — 지수 감소 + 중첩', () => {
  test('단회 투여: 반감기마다 절반', () => {
    const d: DoseEvent[] = [{ t: T0, doseMg: 5 }]
    expect(exponentialSum(d, MOUNJARO_T12, T0)).toBeCloseTo(5, 10)
    expect(exponentialSum(d, MOUNJARO_T12, T0 + MOUNJARO_T12 * H)).toBeCloseTo(2.5, 10)
    expect(exponentialSum(d, MOUNJARO_T12, T0 + 2 * MOUNJARO_T12 * H)).toBeCloseTo(1.25, 10)
  })

  test('투약 전에는 0 (미래 투약은 반영 안 함)', () => {
    expect(exponentialSum([{ t: T0, doseMg: 5 }], MOUNJARO_T12, T0 - 1)).toBe(0)
  })

  test('반복 투여 = 각 단회 투여의 합 (중첩)', () => {
    const doses: DoseEvent[] = [0, 7, 14, 21].map((w) => ({ t: T0 + w * 24 * 7 * H / 7, doseMg: w < 14 ? 2.5 : 5 }))
    const t = T0 + 25 * 24 * H
    const separate = doses.reduce((s, d) => s + exponentialSum([d], MOUNJARO_T12, t), 0)
    expect(exponentialSum(doses, MOUNJARO_T12, t)).toBeCloseTo(separate, 10)
  })

  test('수기 계산과 일치 (계획서 7.3: 같은 입력 → 수기 계산 일치)', () => {
    // 2.5mg 투여 후 7일, 5mg 투여 직후 / t½ 120h
    const doses: DoseEvent[] = [
      { t: T0, doseMg: 2.5 },
      { t: T0 + 168 * H, doseMg: 5 },
    ]
    const manual = 2.5 * Math.pow(0.5, 168 / 120) + 5
    expect(exponentialSum(doses, MOUNJARO_T12, T0 + 168 * H)).toBeCloseTo(manual, 10)
  })

  test('약물별 반감기를 섞지 않는다: 같은 기록이라도 결과가 다르다', () => {
    const d: DoseEvent[] = [{ t: T0, doseMg: 1 }]
    const t = T0 + 120 * H
    expect(exponentialSum(d, MOUNJARO_T12, t)).toBeCloseTo(0.5, 10)
    expect(exponentialSum(d, WEGOVY_T12, t)).toBeCloseTo(Math.pow(0.5, 120 / 168), 10)
  })
})

test.describe('상대값 곡선', () => {
  const doses: DoseEvent[] = [
    { t: T0, doseMg: 2.5 },
    { t: T0 + 168 * H, doseMg: 2.5 },
    { t: T0 + 336 * H, doseMg: 5 },
  ]
  const from = T0 - 24 * H
  const to = T0 + 400 * H

  test('기간 최댓값 = 100, 범위 0~100', () => {
    const pts = relativeCurve(doses, MOUNJARO_T12, from, to)
    const values = pts.map((p) => p.relative)
    expect(Math.max(...values)).toBeCloseTo(100, 10)
    expect(Math.min(...values)).toBeGreaterThanOrEqual(0)
  })

  test('최고점은 실제 계산된 투약 직후 시각에 있다 (보간용 가짜 최고점 없음)', () => {
    const pts = relativeCurve(doses, MOUNJARO_T12, from, to)
    const peak = pts.reduce((a, b) => (b.relative > a.relative ? b : a))
    expect(peak.t).toBe(T0 + 336 * H)
  })

  test('샘플에 투약 직전·직후 시각이 포함된다', () => {
    const times = sampleTimes(from, to, doses)
    for (const d of doses) {
      expect(times).toContain(d.t)
      expect(times).toContain(d.t - 1)
    }
  })

  test('반감기 출처가 없는 약(null)은 곡선을 만들지 않는다', () => {
    expect(relativeCurve(doses, null, from, to)).toEqual([])
  })

  test('기간 안팎 투약 기록이 없으면 빈 곡선', () => {
    expect(relativeCurve([], MOUNJARO_T12, from, to)).toEqual([])
  })
})

test.describe('모델 B — 1차 흡수 1구획 (검증·비교용, 화면 미사용)', () => {
  const ke = LN2 / MOUNJARO_T12

  test('ka → 매우 큼이면 모델 A × F에 수렴', () => {
    const F = 0.8
    const a = batemanAmount(5, F, 50, ke, 72)
    expect(a).toBeCloseTo(F * 5 * Math.pow(0.5, 72 / MOUNJARO_T12), 3)
  })

  test('tmax 역산이 정확하다', () => {
    for (const tmax of [8, 24, 48, 72]) {
      const ka = kaFromTmax(tmax, ke)
      expect(tmaxFromRates(ka, ke)).toBeCloseTo(tmax, 4)
    }
  })

  test('라벨 Tmax 범위(8~72h) 양 끝으로 ka를 정하면 최고점이 크게 달라진다 → ka 없이 mg 표시 불가 근거', () => {
    const F = 0.8 // 라벨 생체이용률
    const kaFast = kaFromTmax(8, ke)
    const kaSlow = kaFromTmax(72, ke)
    const peakFast = batemanAmount(5, F, kaFast, ke, 8)
    const peakSlow = batemanAmount(5, F, kaSlow, ke, 72)
    const diff = (peakFast - peakSlow) / peakSlow
    // 같은 5mg인데 최고점 추정이 10% 넘게, 최고점 시각이 64시간 차이 남
    expect(diff).toBeGreaterThan(0.1)
    test.info().annotations.push({
      type: 'sensitivity',
      description: `5mg 단회: Tmax 8h → 최고 ${peakFast.toFixed(2)}mg, Tmax 72h → 최고 ${peakSlow.toFixed(2)}mg (차이 ${(diff * 100).toFixed(0)}%)`,
    })
  })

  test('모델 B 반복 투여도 중첩이 성립한다', () => {
    const F = 0.8
    const ka = kaFromTmax(24, ke)
    const doses: DoseEvent[] = [
      { t: T0, doseMg: 2.5 },
      { t: T0 + 168 * H, doseMg: 5 },
    ]
    const t = T0 + 200 * H
    const separate = batemanAmount(2.5, F, ka, ke, 200) + batemanAmount(5, F, ka, ke, 32)
    expect(batemanSum(doses, F, ka, ke, t)).toBeCloseTo(separate, 10)
  })
})
