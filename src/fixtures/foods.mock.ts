/**
 * 음식 분류 대상 (예시 20종) — 실제 학습 클래스는 AI Hub 데이터와 식약처 영양 DB를 맞춰 확정.
 * 한 상에 여러 반찬을 먹는 식사를 고려해 밥·국·찌개·반찬을 섞어 구성.
 * 영양 값은 화면 확인용 예시 값 — 실제로는 식약처 식품영양성분 DB 대표 1인분 값을 쓴다.
 */
export interface Food {
  id: string
  name: string
  kind: '밥·면' | '국·찌개' | '반찬' | '일품' | '기타'
  /** 1인분 기준 (예시 값) */
  kcal: number
  proteinG: number
  carbG: number
  fatG: number
}

export const FOODS: Food[] = [
  { id: 'rice', name: '쌀밥', kind: '밥·면', kcal: 300, proteinG: 5, carbG: 66, fatG: 1 },
  { id: 'kimchi-jjigae', name: '김치찌개', kind: '국·찌개', kcal: 250, proteinG: 15, carbG: 12, fatG: 15 },
  { id: 'doenjang-jjigae', name: '된장찌개', kind: '국·찌개', kcal: 160, proteinG: 11, carbG: 12, fatG: 7 },
  { id: 'sundubu', name: '순두부찌개', kind: '국·찌개', kcal: 200, proteinG: 14, carbG: 9, fatG: 12 },
  { id: 'miyeokguk', name: '미역국', kind: '국·찌개', kcal: 110, proteinG: 9, carbG: 5, fatG: 6 },
  { id: 'kimchi', name: '배추김치', kind: '반찬', kcal: 20, proteinG: 1, carbG: 4, fatG: 0 },
  { id: 'spinach', name: '시금치나물', kind: '반찬', kcal: 45, proteinG: 2, carbG: 4, fatG: 3 },
  { id: 'kongnamul', name: '콩나물무침', kind: '반찬', kcal: 35, proteinG: 3, carbG: 3, fatG: 2 },
  { id: 'myeolchi', name: '멸치볶음', kind: '반찬', kcal: 90, proteinG: 8, carbG: 8, fatG: 3 },
  { id: 'gyeranmari', name: '계란말이', kind: '반찬', kcal: 140, proteinG: 10, carbG: 2, fatG: 10 },
  { id: 'jeyuk', name: '제육볶음', kind: '일품', kcal: 380, proteinG: 24, carbG: 14, fatG: 25 },
  { id: 'bulgogi', name: '불고기', kind: '일품', kcal: 300, proteinG: 22, carbG: 15, fatG: 16 },
  { id: 'godeungeo', name: '고등어구이', kind: '일품', kcal: 250, proteinG: 22, carbG: 0, fatG: 18 },
  { id: 'japchae', name: '잡채', kind: '반찬', kcal: 220, proteinG: 5, carbG: 32, fatG: 8 },
  { id: 'bibimbap', name: '비빔밥', kind: '밥·면', kcal: 580, proteinG: 18, carbG: 90, fatG: 15 },
  { id: 'gimbap', name: '김밥', kind: '밥·면', kcal: 480, proteinG: 13, carbG: 80, fatG: 11 },
  { id: 'tteokbokki', name: '떡볶이', kind: '일품', kcal: 480, proteinG: 9, carbG: 98, fatG: 5 },
  { id: 'ramyeon', name: '라면', kind: '밥·면', kcal: 500, proteinG: 10, carbG: 78, fatG: 16 },
  { id: 'samgyeopsal', name: '삼겹살구이', kind: '일품', kcal: 660, proteinG: 25, carbG: 0, fatG: 62 },
  { id: 'chicken-salad', name: '닭가슴살샐러드', kind: '기타', kcal: 200, proteinG: 26, carbG: 10, fatG: 6 },
]

export const foodById = (id: string) => FOODS.find((f) => f.id === id)!

/**
 * 목업 인식 결과 순서 — 그린 영역 순서대로 돌려준다.
 * 실제 AI 결과가 아니며, 확신 높음/낮음 두 상태를 모두 보여주기 위한 예시.
 */
export const MOCK_PREDICTIONS: { confident: boolean; candidates: string[] }[] = [
  { confident: true, candidates: ['kimchi-jjigae', 'sundubu', 'doenjang-jjigae'] },
  { confident: true, candidates: ['rice', 'bibimbap', 'gimbap'] },
  { confident: false, candidates: ['spinach', 'kongnamul', 'myeolchi'] },
  { confident: false, candidates: ['gyeranmari', 'japchae', 'kimchi'] },
  { confident: true, candidates: ['kimchi', 'kongnamul', 'spinach'] },
  { confident: false, candidates: ['jeyuk', 'bulgogi', 'tteokbokki'] },
]
