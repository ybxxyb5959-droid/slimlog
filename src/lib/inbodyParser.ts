/**
 * 인바디 결과지 OCR 글자 → 수치 (계획서 6.4)
 * 상대 import 만 쓴다 (단위 테스트에서 그대로 불러오기 위함).
 *
 * - 라벨 근처의 숫자를 찾는다: '체중 72.4', '골격근량 30.1 kg', '체지방률 (%) 25.3'
 * - OCR 이 흔히 틀리는 글자 보정: O→0, l/I→1, ','→'.'
 * - 범위·교차 검증 실패 항목은 '확인 필요'로 표시하고 값은 미리 채워만 둔다 (사용자가 고친 값만 저장)
 */
export type InbodyField = 'weightKg' | 'skeletalMuscleKg' | 'bodyFatKg' | 'bodyFatPct'

export interface ParsedInbody {
  values: Partial<Record<InbodyField, number>>
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
  return s.replace(/(?<=\d)[oO](?=\d|\b)/g, '0').replace(/(?<=\d)[lI](?=\d)/g, '1').replace(/(\d),(\d)/g, '$1.$2')
}

/** 라벨이 나온 줄(또는 바로 다음 줄)에서 첫 번째 소수 숫자 */
function valueAfter(lines: string[], re: RegExp): number | undefined {
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(re)
    if (!m) continue
    const rest = lines[i].slice((m.index ?? 0) + m[0].length) + ' ' + (lines[i + 1] ?? '')
    const n = rest.match(/(\d{1,3}(?:\.\d{1,2})?)/)
    if (n) return Number(n[1])
  }
  return undefined
}

export function parseInbody(text: string): ParsedInbody {
  const lines = fixOcr(text).split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  const values: ParsedInbody['values'] = {}
  const problems: ParsedInbody['problems'] = []
  for (const f of Object.keys(LABELS) as InbodyField[]) {
    const v = valueAfter(lines, LABELS[f])
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
  return { values, problems, manualRecommended: values.weightKg === undefined || crossFails >= 2 }
}
