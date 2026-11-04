/** 영양제 자동완성 후보 — 많이 먹는 이름 (검색어로 시작하거나 포함하는 것) */
export const COMMON_SUPPLEMENTS = [
  '종합비타민', '비타민 D', '비타민 C', '비타민 B 컴플렉스', '비타민 E', '오메가3', '유산균(프로바이오틱스)', '마그네슘', '칼슘', '철분',
  '아연', '엽산', '루테인', '밀크씨슬', '콜라겐', '유청 단백질(프로틴)', '식물성 단백질', '크레아틴', '식이섬유', '차전자피',
  '코엔자임Q10', '비오틴', '홍삼', '프로폴리스', '글루코사민', '셀레늄', '가르시니아', '녹차추출물', '전해질', 'BCAA',
]

const norm = (s: string) => s.replace(/\s+/g, '').toLowerCase()

/**
 * 입력값에 맞는 후보 — 내가 전에 쓴 이름 먼저, 그다음 흔한 영양제. 최대 5개 (화면을 가리지 않게)
 * '유' → 유산균, 유청 단백질 …
 */
export function suggest(query: string, mine: string[], common: string[] = COMMON_SUPPLEMENTS, limit = 5): string[] {
  const q = norm(query)
  if (!q) return []
  const score = (n: string) => (norm(n).startsWith(q) ? 0 : norm(n).includes(q) ? 1 : 2)
  const pool = [...new Set([...mine, ...common])].filter((n) => score(n) < 2 && norm(n) !== q)
  const mineSet = new Set(mine)
  return pool.sort((a, b) => score(a) - score(b) || Number(mineSet.has(b)) - Number(mineSet.has(a)) || a.localeCompare(b, 'ko')).slice(0, limit)
}
