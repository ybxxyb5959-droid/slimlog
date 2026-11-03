import { MOCK_PREDICTIONS } from '@/fixtures/foods.mock'

/**
 * 음식 인식 — 목업.
 * 실제: POST /meals/photo (사진 + 영역 좌표) → 서버가 EXIF 제거 후 영역마다 잘라 ONNX 분류 모델로 추론
 *       → 영역별 Top-3. 1순위 확률이 기준값(검증셋에서 0.5·0.6·0.7 비교) 이상이면 자동 제안.
 * 화면에는 확률 숫자를 보여주지 않고 '확신 높음/낮음'만 쓴다.
 */
export interface RegionPrediction {
  confident: boolean
  candidates: string[] // foodId, 1순위부터
}

export async function classifyRegions(count: number): Promise<RegionPrediction[]> {
  await new Promise((r) => setTimeout(r, 1100))
  return Array.from({ length: count }, (_, i) => MOCK_PREDICTIONS[i % MOCK_PREDICTIONS.length])
}
