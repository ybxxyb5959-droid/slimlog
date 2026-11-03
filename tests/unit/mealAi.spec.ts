import { expect, test } from '@playwright/test'

import { getModelStatus, MOCK_MODEL_VERSION, recognizeMeal } from '../../src/services/mealAi'

test('모델이 없으면 목업 모드로 동작하고, 결과에 목업 표시가 붙는다', async () => {
  expect(getModelStatus()).toBe('mock')
  const res = await recognizeMeal({ kind: 'sample' })
  expect(res.mode).toBe('mock')
  expect(res.modelStatus).toBe('mock')
  expect(res.modelVersion).toBe(MOCK_MODEL_VERSION)
})

test('인식 결과마다 내부용 점수·기준값을 갖고, 상태는 인식 결과/확인 필요 둘 중 하나', async () => {
  const { labels } = await recognizeMeal({ kind: 'sample' })
  expect(labels.length).toBeGreaterThan(0)
  for (const l of labels) {
    expect(['recognized', 'review']).toContain(l.status)
    expect(l.candidates[0]).toBe(l.foodId)
    expect(typeof l.score).toBe('number')
    expect(typeof l.threshold).toBe('number')
    // 상태와 점수가 어긋나지 않는다: 기준값 이상이면 인식 결과
    expect(l.status === 'recognized').toBe(l.score! >= l.threshold!)
  }
  expect(labels.some((l) => l.status === 'review')).toBe(true)
})
