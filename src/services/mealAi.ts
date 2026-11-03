/**
 * 음식 사진 인식 — 멀티라벨 분류 계약 (현재는 목업만 동작)
 *
 * 실제(다음 승인 이후): POST /api/meals/recognize (사진 1장)
 *   → 서버가 EXIF 제거 → EfficientNet-B0 멀티라벨 모델(ONNX) 추론
 *   → 클래스마다 sigmoid 점수 → 클래스별 기준값 이상이면 '인식 결과',
 *     기준값보다 조금 낮은 구간이면 '확인 필요'로 돌려준다.
 * 영역(박스)을 그리지 않는다. 사진 전체를 한 번에 본다.
 *
 * 모델이 준비되지 않았으면(model_status: not_loaded) 목업 결과로 시연한다.
 * 목업 결과는 mode: 'mock' 으로 표시되고, 사진 내용과 상관없는 고정 예시다.
 */
import { api } from '@/lib/api'
import type { PhotoRecognition } from '@/services/live/meals'
import type { AiLabelMeta } from '@/types/meal'

export type ModelStatus = 'ready' | 'not_loaded' | 'mock'

export interface RecognizedLabel extends Omit<AiLabelMeta, 'modelVersion' | 'mode'> {
  foodId: string
}

export interface RecognitionResult {
  mode: 'model' | 'mock'
  modelStatus: ModelStatus
  modelVersion: string
  /** 점수 높은 순 */
  labels: RecognizedLabel[]
}

export const MOCK_MODEL_VERSION = 'mock-0'

/** 목업 결과 — '인식 결과'와 '확인 필요'를 모두 보여주기 위한 고정 예시 (실제 점수 아님) */
const MOCK_LABELS: RecognizedLabel[] = [
  { foodId: 'kimchi-jjigae', status: 'recognized', score: 0.91, threshold: 0.5, candidates: ['kimchi-jjigae', 'sundubu', 'doenjang-jjigae'] },
  { foodId: 'rice', status: 'recognized', score: 0.88, threshold: 0.5, candidates: ['rice', 'multigrain-rice'] },
  { foodId: 'kimchi', status: 'recognized', score: 0.74, threshold: 0.55, candidates: ['kimchi', 'kkakdugi'] },
  { foodId: 'spinach', status: 'review', score: 0.41, threshold: 0.55, candidates: ['spinach', 'kongnamul', 'myeolchi'] },
  { foodId: 'gyeranmari', status: 'review', score: 0.37, threshold: 0.5, candidates: ['gyeranmari', 'boiled-egg'] },
]

/** 지금 쓸 수 있는 모델 상태 — 백엔드가 없으므로 항상 mock */
export function getModelStatus(): ModelStatus {
  return 'mock'
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- 실제 연결 시 사진을 보낸다 (목업은 사진을 쓰지 않음)
export async function recognizeMeal(_photo: { kind: 'sample' | 'file'; url?: string }): Promise<RecognitionResult> {
  await new Promise((r) => setTimeout(r, 1100))
  return { mode: 'mock', modelStatus: getModelStatus(), modelVersion: MOCK_MODEL_VERSION, labels: MOCK_LABELS.map((l) => ({ ...l, candidates: [...l.candidates] })) }
}

// ── 실서비스: 서버(FastAPI)가 EXIF 제거·저장·인식 후 초안 식사(draft)를 만든다 ──

export interface LiveRecognition extends RecognitionResult {
  mealId: string
  labels: (RecognizedLabel & { predId: string })[]
}

export async function recognizeMealLive(file: File, mealType: string, eatenAtIso: string): Promise<LiveRecognition> {
  const form = new FormData()
  form.append('file', file)
  form.append('meal_type', mealType)
  form.append('eaten_at', eatenAtIso)
  const r = await api<PhotoRecognition>('/meals/photo', { form })
  return {
    mealId: r.meal_id,
    mode: r.mode,
    modelStatus: r.model_status as ModelStatus,
    modelVersion: r.model_version,
    labels: r.labels.map((l) => ({ foodId: l.food_id, status: l.status, score: l.score, threshold: l.threshold, candidates: l.candidates, predId: l.pred_id })),
  }
}
