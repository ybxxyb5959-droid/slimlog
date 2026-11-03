/**
 * 음식 사진 인식 — 목업 (실제 AI 결과 아님).
 * 실제: POST /meals/photo (사진 + 영역 좌표) → 서버가 EXIF 제거 후 영역마다 잘라 ONNX 분류 모델로 추론 → 영역별 Top-3.
 * 1순위 확률이 기준값(검증셋에서 0.5·0.6·0.7 비교) 이상이면 자동 제안. 화면에는 확률 숫자를 보여주지 않는다.
 * supported=false: 학습한 20종 밖으로 보이는 경우 → 검색으로만 고른다.
 */
export interface RegionPrediction {
  confident: boolean
  supported: boolean
  candidates: string[] // foodId, 1순위부터
}

/** 그린 영역 순서대로 돌려주는 예시 결과 — 확신 높음·낮음·미지원 상태를 모두 보여주기 위함 */
const MOCK: RegionPrediction[] = [
  { confident: true, supported: true, candidates: ['kimchi-jjigae', 'sundubu', 'doenjang-jjigae'] },
  { confident: true, supported: true, candidates: ['rice', 'bibimbap', 'gimbap'] },
  { confident: false, supported: true, candidates: ['spinach', 'kongnamul', 'myeolchi'] },
  { confident: false, supported: false, candidates: [] },
  { confident: true, supported: true, candidates: ['kimchi', 'kongnamul', 'spinach'] },
  { confident: false, supported: true, candidates: ['jeyuk', 'bulgogi', 'tteokbokki'] },
]

export async function classifyRegions(count: number): Promise<RegionPrediction[]> {
  await new Promise((r) => setTimeout(r, 1100))
  return Array.from({ length: count }, (_, i) => MOCK[i % MOCK.length])
}
