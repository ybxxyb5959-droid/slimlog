/**
 * 성별·출생연도·활동량 — 온보딩 2·3단계와 신체 정보 화면에서 같이 쓴다.
 * 성별은 온보딩에서 꼭 고른다(열량 계산의 기본값). 출생연도·활동량은 선택.
 */
export type Sex = 'female' | 'male'
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active'

export const SEX_OPTIONS: { value: Sex; label: string }[] = [
  { value: 'male', label: '남성' },
  { value: 'female', label: '여성' },
]

/** factor = 하루 쓰는 열량 ÷ 기초대사량 (일반적으로 쓰는 활동 계수) */
export const ACTIVITY_OPTIONS: { value: ActivityLevel; label: string; factor: number }[] = [
  { value: 'sedentary', label: '거의 앉아서 생활해요', factor: 1.2 },
  { value: 'light', label: '가벼운 활동을 해요', factor: 1.375 },
  { value: 'moderate', label: '주 3~5회 운동해요', factor: 1.55 },
  { value: 'active', label: '매우 활동적이에요', factor: 1.725 },
]

export const isSex = (v: unknown): v is Sex => v === 'female' || v === 'male'
export const isActivity = (v: unknown): v is ActivityLevel => ACTIVITY_OPTIONS.some((a) => a.value === v)

/** 출생연도 — 빈 값은 null(오류 아님). 만 14세 이상만 가입 가능한 서비스 기준 */
export function parseBirthYear(raw: string, now = new Date()): { value: number | null; error: string | null } {
  const v = raw.trim()
  if (!v) return { value: null, error: null }
  if (!/^\d{4}$/.test(v)) return { value: null, error: '출생연도 4자리를 입력해 주세요.' }
  const n = Number(v)
  const max = now.getFullYear() - 14
  if (n < 1920 || n > max) return { value: null, error: `1920~${max}년 사이로 입력해 주세요.` }
  return { value: n, error: null }
}
