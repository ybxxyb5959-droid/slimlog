/**
 * 감량 체중 비유 데이터.
 * approxKg는 일상 물건의 '대표적인 대략 무게'다. 제품·크기에 따라 다르므로
 * 화면에서는 항상 '약', '정도' 같은 근사 표현과 함께 쓴다.
 * minKg 이상 ~ 다음 항목의 minKg 미만 감량에 이 비유를 쓴다.
 */
export type AnalogyIllustrationId = 'apple' | 'milk' | 'padding' | 'cat' | 'watermelon' | 'rice'

export interface WeightAnalogy {
  id: AnalogyIllustrationId
  /** 문장에 들어가는 이름: "{name} 정도 가벼워졌어요" */
  name: string
  approxKg: number
  minKg: number
}

export const WEIGHT_ANALOGIES: WeightAnalogy[] = [
  { id: 'apple', name: '사과 한 개', approxKg: 0.3, minKg: 0.2 },
  { id: 'milk', name: '우유 1L 한 팩', approxKg: 1, minKg: 0.6 },
  { id: 'padding', name: '겨울 패딩 한 벌', approxKg: 1.5, minKg: 1.3 },
  { id: 'cat', name: '고양이 한 마리', approxKg: 4, minKg: 2.5 },
  { id: 'watermelon', name: '수박 한 통', approxKg: 6, minKg: 5 },
  { id: 'rice', name: '쌀 10kg 한 포대', approxKg: 10, minKg: 8 },
]

/** 이 값보다 적게 빠졌으면 비유 대신 중립 요약 */
export const ANALOGY_MIN_LOSS_KG = 0.2
