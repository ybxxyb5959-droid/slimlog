/**
 * 참고용 약물 잔존 계산 (계획서 6.3).
 * 이 파일은 상대 import만 쓴다 — 단위 테스트(Playwright)에서 그대로 불러오기 위함.
 *
 * 모델 A (사용 중): 단순 지수 감소 + 반복 투여 중첩
 *   r(t) = Σ D_i · (1/2)^((t − t_i) / t½)   (t ≥ t_i)
 *   화면에는 표시 기간 최댓값 = 100인 상대값만 쓴다. r(t)의 단위를 mg로 표시하지 않는다.
 *   (흡수 과정과 생체이용률을 반영하지 않으므로 '체내에 남은 mg'이 아니다.)
 *
 * 모델 B (비교·검증용, 화면 미사용): 1차 흡수 1구획 모델 (Bateman)
 *   A(t) = F · D · ka / (ka − ke) · (e^(−ke·t) − e^(−ka·t))
 *   ka가 허가자료에 없어 실제 화면에는 쓰지 않는다.
 */

export interface DoseEvent {
  /** epoch ms */
  t: number
  doseMg: number
}

const HOUR = 3600 * 1000
export const LN2 = Math.LN2

/** 모델 A — 시각 t에서의 중첩 합 (내부 계산값, 단위 표시 금지) */
export function exponentialSum(doses: DoseEvent[], halfLifeHours: number, t: number) {
  const ke = LN2 / halfLifeHours
  let sum = 0
  for (const d of doses) {
    if (d.t > t) continue
    sum += d.doseMg * Math.exp((-ke * (t - d.t)) / HOUR)
  }
  return sum
}

/**
 * 샘플 시각: 일정 간격 + 각 투약 직전·직후 시각을 반드시 포함
 * → 보간이 투약 시점을 건너뛰어 최고점이 어긋나거나 가짜 최고점이 생기지 않게 한다.
 */
export function sampleTimes(from: number, to: number, doses: DoseEvent[], stepHours = 3) {
  const set = new Set<number>()
  for (let t = from; t <= to; t += stepHours * HOUR) set.add(t)
  set.add(to)
  for (const d of doses) {
    if (d.t > from && d.t <= to) {
      set.add(d.t - 1) // 직전 (1ms)
      set.add(d.t)
    }
  }
  return [...set].sort((a, b) => a - b)
}

export interface RelativePoint {
  t: number
  /** 0~100, 표시 기간 최댓값 = 100 */
  relative: number
}

/** 모델 A 상대값 곡선. 반감기가 없으면 빈 배열(곡선 미생성) */
export function relativeCurve(
  doses: DoseEvent[],
  halfLifeHours: number | null,
  from: number,
  to: number,
  stepHours = 3,
): RelativePoint[] {
  if (!halfLifeHours || halfLifeHours <= 0) return []
  const times = sampleTimes(from, to, doses, stepHours)
  const raw = times.map((t) => ({ t, v: exponentialSum(doses, halfLifeHours, t) }))
  const max = Math.max(0, ...raw.map((p) => p.v))
  if (max === 0) return []
  return raw.map((p) => ({ t: p.t, relative: (p.v / max) * 100 }))
}

/** 곡선 위 임의 시각의 상대값 (같은 기간 최댓값 기준) */
export function relativeAt(points: RelativePoint[], t: number) {
  if (!points.length) return null
  let best = points[0]
  for (const p of points) if (Math.abs(p.t - t) < Math.abs(best.t - t)) best = p
  return best.relative
}

/* ---------------- 모델 B (검증용) ---------------- */

/** 1차 흡수 1구획 — 단회 투여 후 경과 h시간의 체순환 내 약물량(투여량 단위) */
export function batemanAmount(doseMg: number, F: number, ka: number, ke: number, hours: number) {
  if (hours < 0) return 0
  if (Math.abs(ka - ke) < 1e-12) return F * doseMg * ke * hours * Math.exp(-ke * hours)
  return ((F * doseMg * ka) / (ka - ke)) * (Math.exp(-ke * hours) - Math.exp(-ka * hours))
}

/** 모델 B 중첩 */
export function batemanSum(doses: DoseEvent[], F: number, ka: number, ke: number, t: number) {
  return doses.reduce((s, d) => s + batemanAmount(d.doseMg, F, ka, ke, (t - d.t) / HOUR), 0)
}

/** 단회 투여 최고점 시각 tmax = ln(ka/ke)/(ka−ke) */
export function tmaxFromRates(ka: number, ke: number) {
  return Math.log(ka / ke) / (ka - ke)
}

/** tmax(시간)에 맞는 ka를 이분법으로 역산 (ka > ke 가정) */
export function kaFromTmax(tmaxHours: number, ke: number) {
  let lo = ke * 1.000001
  let hi = 50
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2
    // tmax는 ka가 커질수록 작아진다
    if (tmaxFromRates(mid, ke) > tmaxHours) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}
