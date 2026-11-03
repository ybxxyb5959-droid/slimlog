import type { FoodItem } from '@/types/meal'

/**
 * 음식 사전 — 목업 샘플 데이터.
 * 영양 값은 화면 확인용 예시 값이며 실제 제품·식약처 DB의 정확한 수치가 아니다.
 * 브랜드 이름은 검색 예시를 위한 것이며 해당 제품의 공식 수치를 뜻하지 않는다.
 * 식약처 식품영양성분 DB 연결 시 services/foodCatalog.ts만 교체한다.
 */
const serving = (g: number, label: string) => ({ basisGrams: g, basisLabel: `${label}(${g}g)당`, servingGrams: g })
const per100 = (servingG: number) => ({ basisGrams: 100, basisLabel: '100g당', servingGrams: servingG })

export const FOOD_CATALOG: FoodItem[] = [
  // 밥·면 — AI 분류 대상 포함
  { id: 'rice', name: '쌀밥', category: '밥·면', ...serving(210, '1공기'), kcal: 310, carbG: 68, proteinG: 5.5, fatG: 0.6 },
  { id: 'multigrain-rice', name: '잡곡밥', category: '밥·면', ...serving(210, '1공기'), kcal: 300, carbG: 64, proteinG: 7, fatG: 1.5 },
  { id: 'bibimbap', name: '비빔밥', category: '밥·면', ...serving(450, '1그릇'), kcal: 580, carbG: 90, proteinG: 18, fatG: 15 },
  { id: 'gimbap', name: '김밥', category: '밥·면', ...serving(230, '1줄'), kcal: 420, carbG: 70, proteinG: 12, fatG: 10 },
  { id: 'ramyeon', name: '라면', category: '밥·면', ...serving(550, '1그릇'), kcal: 500, carbG: 78, proteinG: 10, fatG: 16 },
  { id: 'naengmyeon', name: '물냉면', category: '밥·면', ...serving(600, '1그릇'), kcal: 520, carbG: 98, proteinG: 16, fatG: 5 },
  { id: 'kalguksu', name: '칼국수', category: '밥·면', ...serving(650, '1그릇'), kcal: 560, carbG: 95, proteinG: 20, fatG: 9 },
  { id: 'fried-rice', name: '김치볶음밥', category: '밥·면', ...serving(350, '1접시'), kcal: 560, carbG: 82, proteinG: 13, fatG: 19 },
  // 국·찌개
  { id: 'kimchi-jjigae', name: '김치찌개', category: '국·찌개', ...serving(400, '1그릇'), kcal: 250, carbG: 12, proteinG: 15, fatG: 15 },
  { id: 'doenjang-jjigae', name: '된장찌개', category: '국·찌개', ...serving(400, '1그릇'), kcal: 160, carbG: 12, proteinG: 11, fatG: 7 },
  { id: 'sundubu', name: '순두부찌개', category: '국·찌개', ...serving(400, '1그릇'), kcal: 200, carbG: 9, proteinG: 14, fatG: 12 },
  { id: 'miyeokguk', name: '미역국', category: '국·찌개', ...serving(350, '1그릇'), kcal: 110, carbG: 5, proteinG: 9, fatG: 6 },
  { id: 'galbitang', name: '갈비탕', category: '국·찌개', ...serving(600, '1그릇'), kcal: 420, carbG: 8, proteinG: 35, fatG: 27 },
  { id: 'samgyetang', name: '삼계탕', category: '국·찌개', ...serving(900, '1그릇'), kcal: 900, carbG: 40, proteinG: 85, fatG: 42 },
  { id: 'kongnamulguk', name: '콩나물국', category: '국·찌개', ...serving(350, '1그릇'), kcal: 50, carbG: 4, proteinG: 4, fatG: 2 },
  // 반찬
  { id: 'kimchi', name: '배추김치', category: '반찬', ...per100(50), kcal: 18, carbG: 3.5, proteinG: 1.4, fatG: 0.4 },
  { id: 'kkakdugi', name: '깍두기', category: '반찬', ...per100(50), kcal: 30, carbG: 6.5, proteinG: 1.2, fatG: 0.3 },
  { id: 'spinach', name: '시금치나물', category: '반찬', ...per100(70), kcal: 64, carbG: 6, proteinG: 3, fatG: 4 },
  { id: 'kongnamul', name: '콩나물무침', category: '반찬', ...per100(70), kcal: 50, carbG: 4, proteinG: 4, fatG: 2.5 },
  { id: 'myeolchi', name: '멸치볶음', category: '반찬', ...per100(30), kcal: 300, carbG: 27, proteinG: 27, fatG: 10 },
  { id: 'gyeranmari', name: '계란말이', category: '반찬', ...per100(100), kcal: 140, carbG: 2, proteinG: 10, fatG: 10 },
  { id: 'japchae', name: '잡채', category: '반찬', ...per100(150), kcal: 147, carbG: 21, proteinG: 3.3, fatG: 5.3 },
  { id: 'dubu-jorim', name: '두부조림', category: '반찬', ...per100(100), kcal: 120, carbG: 5, proteinG: 9, fatG: 7 },
  { id: 'eomuk-bokkeum', name: '어묵볶음', category: '반찬', ...per100(70), kcal: 160, carbG: 17, proteinG: 8, fatG: 7 },
  { id: 'gamja-jorim', name: '감자조림', category: '반찬', ...per100(80), kcal: 110, carbG: 22, proteinG: 2, fatG: 1.5 },
  // 일품
  { id: 'jeyuk', name: '제육볶음', category: '일품', ...serving(200, '1인분'), kcal: 380, carbG: 14, proteinG: 24, fatG: 25 },
  { id: 'bulgogi', name: '불고기', category: '일품', ...serving(200, '1인분'), kcal: 300, carbG: 15, proteinG: 22, fatG: 16 },
  { id: 'godeungeo', name: '고등어구이', category: '일품', ...serving(120, '1토막'), kcal: 250, carbG: 0, proteinG: 22, fatG: 18 },
  { id: 'tteokbokki', name: '떡볶이', category: '일품', ...serving(300, '1인분'), kcal: 480, carbG: 98, proteinG: 9, fatG: 5 },
  { id: 'samgyeopsal', name: '삼겹살구이', category: '일품', ...per100(200), kcal: 330, carbG: 0, proteinG: 13, fatG: 31 },
  { id: 'chicken-breast', name: '닭가슴살', category: '일품', ...per100(100), kcal: 110, carbG: 0, proteinG: 23, fatG: 1.5 },
  { id: 'chicken-salad', name: '닭가슴살샐러드', category: '일품', ...serving(250, '1팩'), kcal: 200, carbG: 10, proteinG: 26, fatG: 6 },
  { id: 'boiled-egg', name: '삶은 달걀', category: '일품', basisGrams: 50, basisLabel: '1개(50g)당', servingGrams: 50, units: [{ label: '1개', grams: 50 }], kcal: 75, carbG: 0.5, proteinG: 6, fatG: 5 },
  { id: 'tofu', name: '두부', category: '일품', ...per100(150), kcal: 80, carbG: 2, proteinG: 8.5, fatG: 4.5 },
  // 편의점
  { id: 'cvs-sandwich', name: '햄치즈 샌드위치', brand: '편의점 (예시)', category: '편의점', basisGrams: 150, basisLabel: '1개(150g)당', servingGrams: 150, units: [{ label: '1개', grams: 150 }], kcal: 360, carbG: 38, proteinG: 15, fatG: 16 },
  { id: 'cvs-triangle-tuna', name: '참치마요 삼각김밥', brand: '편의점 (예시)', category: '편의점', basisGrams: 110, basisLabel: '1개(110g)당', servingGrams: 110, units: [{ label: '1개', grams: 110 }], kcal: 210, carbG: 34, proteinG: 5, fatG: 6 },
  { id: 'cvs-dosirak', name: '제육 도시락', brand: '편의점 (예시)', category: '편의점', basisGrams: 400, basisLabel: '1개(400g)당', servingGrams: 400, units: [{ label: '1개', grams: 400 }], kcal: 720, carbG: 105, proteinG: 26, fatG: 22 },
  { id: 'cvs-chicken-breast', name: '훈제 닭가슴살', brand: '편의점 (예시)', category: '편의점', basisGrams: 100, basisLabel: '1팩(100g)당', servingGrams: 100, units: [{ label: '1팩', grams: 100 }], kcal: 120, carbG: 2, proteinG: 23, fatG: 2 },
  { id: 'cvs-salad', name: '리코타 샐러드', brand: '편의점 (예시)', category: '편의점', basisGrams: 180, basisLabel: '1개(180g)당', servingGrams: 180, units: [{ label: '1개', grams: 180 }], kcal: 190, carbG: 12, proteinG: 8, fatG: 12 },
  { id: 'cvs-boiled-egg', name: '구운란 2입', brand: '편의점 (예시)', category: '편의점', basisGrams: 100, basisLabel: '1팩(2개, 100g)당', servingGrams: 100, units: [{ label: '1팩', grams: 100 }, { label: '1개', grams: 50 }], kcal: 150, carbG: 1, proteinG: 12, fatG: 10 },
  // 가공식품 (브랜드 예시)
  { id: 'hetbahn', name: '햇반 백미밥', brand: 'CJ제일제당 (예시 값)', category: '가공식품', basisGrams: 210, basisLabel: '1개(210g)당', servingGrams: 210, units: [{ label: '1개', grams: 210 }], kcal: 315, carbG: 69, proteinG: 5, fatG: 0.8 },
  { id: 'hetbahn-small', name: '햇반 작은공기', brand: 'CJ제일제당 (예시 값)', category: '가공식품', basisGrams: 130, basisLabel: '1개(130g)당', servingGrams: 130, units: [{ label: '1개', grams: 130 }], kcal: 195, carbG: 43, proteinG: 3, fatG: 0.5 },
  { id: 'protein-drink', name: '단백질 음료', brand: '예시 브랜드', category: '음료', basisGrams: 250, basisLabel: '1팩(250ml)당', servingGrams: 250, units: [{ label: '1팩', grams: 250 }], kcal: 160, carbG: 8, proteinG: 24, fatG: 3.5 },
  { id: 'greek-yogurt', name: '그릭요거트', brand: '예시 브랜드', category: '가공식품', basisGrams: 100, basisLabel: '1컵(100g)당', servingGrams: 100, units: [{ label: '1컵', grams: 100 }], kcal: 100, carbG: 6, proteinG: 10, fatG: 4 },
  { id: 'soy-milk', name: '두유', brand: '예시 브랜드', category: '음료', basisGrams: 190, basisLabel: '1팩(190ml)당', servingGrams: 190, units: [{ label: '1팩', grams: 190 }], kcal: 130, carbG: 13, proteinG: 7, fatG: 5.5 },
  { id: 'cup-ramyeon', name: '컵라면', brand: '예시 브랜드', category: '가공식품', basisGrams: 65, basisLabel: '1개(65g)당', servingGrams: 65, units: [{ label: '1개', grams: 65 }], kcal: 290, carbG: 42, proteinG: 6, fatG: 11 },
  { id: 'protein-bar', name: '프로틴바', brand: '예시 브랜드', category: '가공식품', basisGrams: 40, basisLabel: '1개(40g)당', servingGrams: 40, units: [{ label: '1개', grams: 40 }], kcal: 170, carbG: 17, proteinG: 12, fatG: 6 },
  { id: 'oatmeal', name: '오트밀', category: '가공식품', ...per100(40), kcal: 380, carbG: 66, proteinG: 13, fatG: 7 },
  // 과일·간식·음료
  { id: 'banana', name: '바나나', category: '과일·간식', basisGrams: 100, basisLabel: '100g당', servingGrams: 120, units: [{ label: '1개', grams: 120 }], kcal: 90, carbG: 23, proteinG: 1.1, fatG: 0.3 },
  { id: 'apple', name: '사과', category: '과일·간식', basisGrams: 100, basisLabel: '100g당', servingGrams: 200, units: [{ label: '1개', grams: 200 }], kcal: 52, carbG: 14, proteinG: 0.3, fatG: 0.2 },
  { id: 'sweet-potato', name: '고구마', category: '과일·간식', basisGrams: 100, basisLabel: '100g당', servingGrams: 150, units: [{ label: '1개', grams: 150 }], kcal: 130, carbG: 31, proteinG: 1.4, fatG: 0.2 },
  { id: 'almond', name: '아몬드', category: '과일·간식', ...per100(25), kcal: 600, carbG: 20, proteinG: 21, fatG: 52 },
  { id: 'milk', name: '우유', category: '음료', basisGrams: 200, basisLabel: '1팩(200ml)당', servingGrams: 200, units: [{ label: '1팩', grams: 200 }], kcal: 130, carbG: 10, proteinG: 6, fatG: 7 },
  { id: 'americano', name: '아메리카노', category: '음료', basisGrams: 355, basisLabel: '1잔(355ml)당', servingGrams: 355, units: [{ label: '1잔', grams: 355 }], kcal: 10, carbG: 2, proteinG: 1, fatG: 0 },
  { id: 'latte', name: '카페라테', category: '음료', basisGrams: 355, basisLabel: '1잔(355ml)당', servingGrams: 355, units: [{ label: '1잔', grams: 355 }], kcal: 180, carbG: 14, proteinG: 10, fatG: 9 },
]

/** 사진 AI 분류 대상 (예시 20종 — 밥·국·찌개·반찬 포함) */
export const AI_CLASS_IDS = [
  'rice', 'kimchi-jjigae', 'doenjang-jjigae', 'sundubu', 'miyeokguk', 'kimchi', 'spinach', 'kongnamul', 'myeolchi', 'gyeranmari',
  'jeyuk', 'bulgogi', 'godeungeo', 'japchae', 'bibimbap', 'gimbap', 'tteokbokki', 'ramyeon', 'samgyeopsal', 'chicken-salad',
]

/** 처음 보이는 즐겨찾기 (목업) */
export const DEFAULT_FAVORITES = ['chicken-breast', 'greek-yogurt', 'hetbahn']
