/** 자동 닉네임: 형용사 + 명사 (예: 우는자몽, 졸린복숭아, 느긋한판다) */
export const NICK_ADJECTIVES = [
  '우는', '졸린', '느긋한', '용감한', '수줍은', '반짝이는', '배부른', '산뜻한', '포근한', '씩씩한',
  '차분한', '상냥한', '꼼꼼한', '부지런한', '말랑한', '신나는', '조용한', '따뜻한', '날쌘', '든든한',
]
export const NICK_NOUNS = [
  '자몽', '복숭아', '판다', '고래', '다람쥐', '토끼', '참외', '감귤', '펭귄', '수달',
  '두부', '호두', '레몬', '해달', '고슴도치', '망고', '사과', '오리', '라임', '부엉이',
]

export function generateNickname(exclude: Iterable<string> = [], random: () => number = Math.random) {
  const skip = new Set(exclude)
  for (let i = 0; i < 30; i++) {
    const n = NICK_ADJECTIVES[Math.floor(random() * NICK_ADJECTIVES.length)] + NICK_NOUNS[Math.floor(random() * NICK_NOUNS.length)]
    if (!skip.has(n)) return n
  }
  // 조합이 바닥나면 숫자를 붙인다
  return NICK_ADJECTIVES[0] + NICK_NOUNS[0] + Math.floor(random() * 900 + 100)
}

const RESERVED = ['관리자', '운영자', '슬림로그', 'slimlog', 'admin']

/** 형식 검사 (서버도 같은 규칙으로 한 번 더 검사) */
export function validateNickname(raw: string): string | null {
  const v = raw.trim()
  if (v.length < 2) return '2자 이상 입력해 주세요.'
  if (v.length > 10) return '10자 이하로 입력해 주세요.'
  if (!/^[가-힣a-zA-Z0-9]+$/.test(v)) return '한글, 영문, 숫자만 쓸 수 있어요. (띄어쓰기·특수문자 불가)'
  if (RESERVED.some((r) => v.toLowerCase().includes(r))) return '사용할 수 없는 단어가 들어 있어요.'
  return null
}
