/**
 * 인바디 결과지 · 인바디 앱 화면 캡처의 OCR 글자 → 수치 (계획서 6.4)
 * 상대 import 만 쓴다 (단위 테스트에서 그대로 불러오기 위함).
 *
 * - 라벨 근처의 숫자를 찾는다: '체중 72.4', '골격근량 30.1 kg', '체지방률 (%) 25.3'
 * - OCR 이 흔히 틀리는 글자 보정: O→0, l/I→1, ','→'.'
 * - 범위·교차 검증 실패 항목은 '확인 필요'로 표시하고 값은 미리 채워만 둔다 (사용자가 고친 값만 저장)
 */
export type InbodyField = 'weightKg' | 'skeletalMuscleKg' | 'bodyFatKg' | 'bodyFatPct'

export interface ParsedInbody {
  values: Partial<Record<InbodyField, number>>
  /** 화면에서 찾은 측정 시각 (예: 인바디 앱 '24.09.03 09:56') — 없으면 undefined */
  measuredAt?: Date
  problems: { field: InbodyField | 'cross'; message: string }[]
  /** 필수(체중) 인식 실패 또는 교차 검증 2개 이상 실패 → 수동 입력 권장 */
  manualRecommended: boolean
}

const LABELS: Record<InbodyField, RegExp> = {
  weightKg: /(체\s*중|weight)(?!\s*조절)/i,
  skeletalMuscleKg: /(골\s*격\s*근\s*량|skeletal\s*muscle\s*mass|smm)/i,
  bodyFatKg: /(체\s*지\s*방\s*량|body\s*fat\s*mass)/i,
  bodyFatPct: /(체\s*지\s*방\s*률|percent\s*body\s*fat|pbf)/i,
}

const RANGE: Record<InbodyField, [number, number]> = {
  weightKg: [20, 300],
  skeletalMuscleKg: [5, 80],
  bodyFatKg: [1, 150],
  bodyFatPct: [2, 75],
}

function fixOcr(s: string) {
  return s
    .replace(/(?<=\d)[oO](?=\d|\b)/g, '0')
    .replace(/(?<=\d)[lI](?=\d)/g, '1')
    .replace(/(\d),(\d)/g, '$1.$2')
    // 인바디 앱은 정수는 크게, 소수는 작게 써서 OCR 이 '79 .2' 처럼 띄어 읽는다 → '79.2'
    .replace(/(\d{1,3})\s+[.·]\s*(\d)\b/g, '$1.$2')
}

/** 한 줄에 라벨이 여러 개(옆으로 나란한 카드)면, 다음 줄 숫자를 순서대로 짝짓는다 */
function columnValues(lines: string[]): Partial<Record<InbodyField, number>> {
  const out: Partial<Record<InbodyField, number>> = {}
  for (let i = 0; i < lines.length - 1; i++) {
    const found = (Object.keys(LABELS) as InbodyField[])
      .map((f) => ({ f, at: lines[i].search(LABELS[f]) }))
      .filter((x) => x.at >= 0)
      .sort((a, b) => a.at - b.at)
    if (found.length < 2) continue
    const nums = (lines[i + 1].match(/\d{1,3}(?:\.\d{1,2})?/g) ?? []).map(Number)
    if (nums.length !== found.length) continue
    found.forEach((x, k) => (out[x.f] = nums[k]))
  }
  return out
}

/** '24.09.03 09:56' · '2024.09.03 09:56' · '2024-09-03 09:56' */
function findDate(text: string): Date | undefined {
  const m = text.match(/\b(\d{2}|\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})\.?\s+(\d{1,2}):(\d{2})/)
  if (!m) return undefined
  const y = m[1].length === 2 ? 2000 + Number(m[1]) : Number(m[1])
  const d = new Date(y, Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]))
  return Number.isNaN(d.getTime()) || d.getTime() > Date.now() + 60_000 ? undefined : d
}

/**
 * 줄에서 '값'으로 볼 숫자만 남긴다 (종이 결과지 대응)
 * - 표준 범위 '(62.6~84.0)' 제거
 * - 막대 그래프 눈금(55 70 85 100 … 처럼 같은 간격으로 3개 이상 이어진 숫자) 제거
 */
function valueCandidates(segment: string): number[] {
  const cleaned = segment.replace(/\(\s*[\d.]+\s*[~∼-]\s*[\d.]+\s*\)/g, ' ')
  const tokens = cleaned.match(/\d{1,3}(?:\.\d{1,2})?/g) ?? []
  const nums = tokens.map(Number)
  const tick = new Array(nums.length).fill(false)
  for (let i = 0; i + 2 < nums.length; i++) {
    const d = nums[i + 1] - nums[i]
    if (d <= 0) continue
    let j = i + 1
    while (j + 1 < nums.length && Math.abs(nums[j + 1] - nums[j] - d) < 1e-9) j++
    if (j - i >= 2) for (let k = i; k <= j; k++) tick[k] = true
  }
  return nums.filter((_, i) => !tick[i])
}

/**
 * 라벨 값 찾기
 * 1) 라벨이 나온 줄 안에서 (눈금·범위를 뺀) 값 — 처음 나온 줄 우선 (아래 '신체변화' 이력표보다 먼저)
 * 2) 없으면 라벨 바로 다음 줄의 첫 숫자 (앱 화면처럼 라벨과 숫자가 다른 줄일 때)
 */
function valueAfter(lines: string[], re: RegExp): number | undefined {
  const hits: { i: number; rest: string }[] = []
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(re)
    if (m) hits.push({ i, rest: lines[i].slice((m.index ?? 0) + m[0].length) })
  }
  for (const h of hits) {
    const c = valueCandidates(h.rest)
    if (c.length) {
      const dec = c.filter((n) => !Number.isInteger(n))
      return (dec.length ? dec : c)[0]
    }
  }
  for (const h of hits) {
    const c = valueCandidates(lines[h.i + 1] ?? '')
    if (c.length) return c[0]
  }
  return undefined
}

export function parseInbody(text: string): ParsedInbody {
  const lines = fixOcr(text).split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  const columns = columnValues(lines)
  const values: ParsedInbody['values'] = {}
  const problems: ParsedInbody['problems'] = []
  for (const f of Object.keys(LABELS) as InbodyField[]) {
    const v = columns[f] ?? valueAfter(lines, LABELS[f])
    if (v === undefined) continue
    const [lo, hi] = RANGE[f]
    if (v < lo || v > hi) problems.push({ field: f, message: `${lo}~${hi} 범위를 벗어났어요` })
    values[f] = v
  }
  if (values.weightKg === undefined) problems.push({ field: 'weightKg', message: '체중을 찾지 못했어요' })
  let crossFails = 0
  const w = values.weightKg
  if (w !== undefined) {
    if (values.skeletalMuscleKg !== undefined && values.skeletalMuscleKg >= w) {
      crossFails++
      problems.push({ field: 'cross', message: '골격근량이 체중보다 커요' })
    }
    if (values.bodyFatKg !== undefined && values.bodyFatKg >= w) {
      crossFails++
      problems.push({ field: 'cross', message: '체지방량이 체중보다 커요' })
    }
    if (values.bodyFatKg !== undefined && values.bodyFatPct !== undefined && Math.abs((values.bodyFatKg / w) * 100 - values.bodyFatPct) > 1) {
      crossFails++
      problems.push({ field: 'cross', message: '체지방량 ÷ 체중과 체지방률이 1% 넘게 달라요' })
    }
  }
  return { values, measuredAt: findDate(fixOcr(text)), problems, manualRecommended: values.weightKg === undefined || crossFails >= 2 }
}
