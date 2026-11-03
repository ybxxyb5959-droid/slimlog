/** 숫자 입력 검사 — 빈 값은 null(오류 아님), 범위·소수점 자리 확인 */
export function parseMeasure(raw: string, min: number, max: number, unit: string, maxDecimals = 1): { value: number | null; error: string | null } {
  const v = raw.trim().replace(',', '.')
  if (!v) return { value: null, error: null }
  if (!/^\d+(\.\d+)?$/.test(v)) return { value: null, error: '숫자만 입력해 주세요.' }
  if ((v.split('.')[1]?.length ?? 0) > maxDecimals) return { value: null, error: `소수점 ${maxDecimals}자리까지 입력할 수 있어요.` }
  const n = Number(v)
  if (n < min || n > max) return { value: null, error: `${min}~${max}${unit} 사이로 입력해 주세요.` }
  return { value: n, error: null }
}

export const RANGES = {
  height: { min: 100, max: 250, unit: 'cm' },
  weight: { min: 20, max: 300, unit: 'kg' }, // 계획서 6.4 체중 범위와 동일
} as const
