/**
 * 식단 사진 음식 인식 — 화면 쪽 계약
 *
 * 실서비스: POST /meals/photo (purpose=meal_photo) → FastAPI 가 EXIF 제거·저장 후
 *   서버에서만 Gemini 를 불러 음식 이름·예상 인분을 받고, 식약처 영양 DB(foods)와 연결해 돌려준다.
 *   이 앱(브라우저)은 Gemini 를 직접 부르지 않고 키도 없다.
 * 칼로리·영양은 AI가 아니라 foods 값으로 계산한다. 분량은 추정값이다.
 * 사용 범위: 식단 사진만 (docs/AI_Gemini_전환계획.md 0장). 눈바디 사진은 여기로 보내지 않는다.
 *
 * 서버가 없으면(목업) 고정 예시 결과로 시연한다 — mode: 'mock', 사진 내용과 상관없음.
 */
import { api } from '@/lib/api'
import type { PhotoRecognition } from '@/services/live/meals'
import type { AiLabelMeta } from '@/types/meal'

export type ModelStatus = 'ready' | 'not_loaded' | 'mock'

export interface RecognizedLabel extends Omit<AiLabelMeta, 'modelVersion' | 'mode'> {
  /** 영양 DB와 연결된 음식. 없으면 null → 사용자가 검색·직접 입력 */
  foodId: string | null
}

export interface RecognitionResult {
  mode: 'model' | 'mock'
  modelStatus: ModelStatus
  modelVersion: string
  labels: RecognizedLabel[]
  /** AI 실패·음식 없음 (사진은 저장됨) */
  aiError?: { code: string; message: string } | null
}

export const MOCK_MODEL_VERSION = 'mock-0'

/** 목업 결과 — '인식 결과'와 '확인 필요'를 모두 보여주기 위한 고정 예시 (실제 분석 아님) */
const MOCK_LABELS: RecognizedLabel[] = [
  { foodId: 'kimchi-jjigae', nameRaw: '김치찌개', status: 'recognized', confidence: 'high', servings: 1, portionText: '1그릇', score: null, threshold: null, candidates: ['kimchi-jjigae', 'sundubu', 'doenjang-jjigae'] },
  { foodId: 'rice', nameRaw: '쌀밥', status: 'recognized', confidence: 'high', servings: 1, portionText: '1공기', score: null, threshold: null, candidates: ['rice', 'multigrain-rice'] },
  { foodId: 'kimchi', nameRaw: '배추김치', status: 'recognized', confidence: 'medium', servings: 1, portionText: '1접시', score: null, threshold: null, candidates: ['kimchi', 'kkakdugi'] },
  { foodId: 'spinach', nameRaw: '시금치나물', status: 'review', confidence: 'low', servings: 1, portionText: '1접시', reason: '다른 나물과 비슷해 보여요', score: null, threshold: null, candidates: ['spinach', 'kongnamul', 'myeolchi'] },
  { foodId: 'gyeranmari', nameRaw: '계란말이', status: 'review', confidence: 'medium', servings: 1, portionText: '2조각', reason: '가려져서 일부만 보여요', score: null, threshold: null, candidates: ['gyeranmari', 'boiled-egg'] },
]

/** 목업 모드의 모델 상태 — 서버가 없으면 항상 mock */
export function getModelStatus(): ModelStatus {
  return 'mock'
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- 목업은 사진을 쓰지 않는다
export async function recognizeMeal(_photo: { kind: 'sample' | 'file'; url?: string }): Promise<RecognitionResult> {
  await new Promise((r) => setTimeout(r, 1100))
  return { mode: 'mock', modelStatus: getModelStatus(), modelVersion: MOCK_MODEL_VERSION, labels: MOCK_LABELS.map((l) => ({ ...l, candidates: [...l.candidates] })) }
}

// ── 실서비스: 서버(FastAPI)가 저장·인식 후 초안 식사(draft)를 만든다 ──

export interface LiveRecognition extends RecognitionResult {
  mealId: string
  labels: (RecognizedLabel & { predId: string })[]
}

export async function recognizeMealLive(file: File, mealType: string, eatenAtIso: string): Promise<LiveRecognition> {
  const form = new FormData()
  form.append('file', file)
  form.append('meal_type', mealType)
  form.append('eaten_at', eatenAtIso)
  form.append('purpose', 'meal_photo') // 서버가 식단 사진인지 확인
  const r = await api<PhotoRecognition>('/meals/photo', { form })
  return {
    mealId: r.meal_id,
    mode: r.mode,
    modelStatus: r.model_status as ModelStatus,
    modelVersion: r.model_version,
    aiError: r.ai_error ?? null,
    labels: r.labels.map((l) => ({
      foodId: l.food_id,
      nameRaw: l.name_raw,
      status: l.status,
      confidence: l.confidence,
      servings: l.servings,
      portionText: l.portion_text,
      reason: l.reason ?? null,
      score: l.score,
      threshold: l.threshold,
      candidates: l.candidates,
      predId: l.pred_id,
    })),
  }
}

/** 확실성 → 화면 표시 (숫자 % 는 보여주지 않음) */
export const confidenceLabel = (c?: 'high' | 'medium' | 'low') => (c === 'high' ? '신뢰도 높음' : c === 'medium' ? '신뢰도 보통' : '확인 필요')
