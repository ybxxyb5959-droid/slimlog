/**
 * 커뮤니티 게시 전 안전 검사 (계획서 6.8) — 목업용 클라이언트 구현.
 * 실제 서비스에서는 서버(FastAPI)가 같은 규칙으로 검사하고 FILTER_LOGS에 남긴다.
 * 키워드 검사는 보조 수단이며 모든 부적절 게시물을 막는다고 보장하지 않는다.
 */
export type SafetyLevel = 'LOW' | 'REVIEW' | 'BLOCKED'

export interface SafetyMatch {
  rule: string
  level: Exclude<SafetyLevel, 'LOW'>
  /** 원문 기준 위치 */
  start: number
  end: number
  text: string
}

export interface SafetyResult {
  level: SafetyLevel
  matches: SafetyMatch[]
}

const RULES: { level: Exclude<SafetyLevel, 'LOW'>; rule: string; words: string[] }[] = [
  { level: 'BLOCKED', rule: '판매·구매', words: ['판매', '팝니다', '삽니다', '구매원해', '구합니다', '직거래', '택배거래'] },
  { level: 'BLOCKED', rule: '양도·나눔', words: ['양도', '나눔', '드려요', '드립니다', '무료로드', '쪽지주세요', '연락주세요'] },
  { level: 'BLOCKED', rule: '처방전 없이 구매', words: ['처방전없이', '처방없이', '처방안받고'] },
  // 쉽게 처방해 주는 병원을 가리키는 은어('성지')·약 이름 은어 — 처방 쇼핑·광고로 이어져서 차단
  { level: 'BLOCKED', rule: '병원·약 은어', words: ['성지', '스시자로'] },
  // 관리자 검토(REVIEW) 단계는 없앰: 용량 질문·병원 이야기는 질문 탭에 자연스럽게 올라올 수 있어서. 차단 규칙만 유지
]

/** 띄어쓰기·특수문자 제거 + 소문자 ('양 도' → '양도'). 원문 위치 매핑을 함께 돌려준다 */
export function normalize(text: string) {
  let out = ''
  const map: number[] = []
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (/[\s\p{P}\p{S}]/u.test(ch)) continue
    out += ch.toLowerCase()
    map.push(i)
  }
  return { out, map }
}

export function checkPost(...parts: string[]): SafetyResult {
  const text = parts.join('\n')
  const { out, map } = normalize(text)
  const matches: SafetyMatch[] = []
  for (const r of RULES) {
    for (const w of r.words) {
      let from = 0
      for (;;) {
        const i = out.indexOf(w, from)
        if (i < 0) break
        const start = map[i]
        const end = map[i + w.length - 1] + 1
        matches.push({ rule: r.rule, level: r.level, start, end, text: text.slice(start, end) })
        from = i + w.length
      }
    }
  }
  const level: SafetyLevel = matches.some((m) => m.level === 'BLOCKED') ? 'BLOCKED' : matches.length ? 'REVIEW' : 'LOW'
  return { level, matches: matches.sort((a, b) => a.start - b.start) }
}
