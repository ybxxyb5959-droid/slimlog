/** 두 글자 성 (복성) */
const COMPOUND_SURNAMES = ['남궁', '제갈', '황보', '선우', '독고', '사공', '서문', '동방', '어금', '망절']

/**
 * 가입 시 이름에서 성을 뺀 부르는 이름.
 * - 한글: '김지원' → '지원', '남궁민수' → '민수', '김 지원' → '지원'
 * - 영문: 'John Smith' → 'John' (이름이 앞)
 * - 한 글자이거나 판단할 수 없으면 그대로
 */
export function givenNameOf(fullName: string | null | undefined): string | null {
  const v = (fullName ?? '').trim().replace(/\s+/g, ' ')
  if (!v) return null
  const isHangul = /^[가-힣 ]+$/.test(v)
  if (!isHangul) return v.split(' ')[0]
  const parts = v.split(' ')
  if (parts.length > 1) return parts.slice(1).join('')
  if (v.length >= 4 && COMPOUND_SURNAMES.some((s) => v.startsWith(s))) return v.slice(2)
  if (v.length >= 2) return v.slice(1)
  return v
}
