import { expect, test } from '@playwright/test'

import { confidenceLabel, getModelStatus, MOCK_MODEL_VERSION, recognizeMeal } from '../../src/services/mealAi'

test('모델이 없으면 목업 모드로 동작하고, 결과에 목업 표시가 붙는다', async () => {
  expect(getModelStatus()).toBe('mock')
  const res = await recognizeMeal({ kind: 'sample' })
  expect(res.mode).toBe('mock')
  expect(res.modelStatus).toBe('mock')
  expect(res.modelVersion).toBe(MOCK_MODEL_VERSION)
})

test('인식 결과마다 AI 이름·확실성·추정 인분만 갖고, 영양 수치는 없다', async () => {
  const { labels } = await recognizeMeal({ kind: 'sample' })
  expect(labels.length).toBeGreaterThan(0)
  for (const l of labels) {
    expect(['recognized', 'review']).toContain(l.status)
    expect(l.candidates[0]).toBe(l.foodId)
    expect(l.nameRaw).toBeTruthy()
    expect(['high', 'medium', 'low']).toContain(l.confidence)
    expect(l.servings).toBeGreaterThan(0)
    // 확인 필요(low)는 바로 담지 않는다
    if (l.confidence === 'low') expect(l.status).toBe('review')
    // 영양 수치는 AI 결과에 없다 (식약처 DB 로 계산)
    expect(Object.keys(l).some((k) => /kcal|carb|protein|fat/i.test(k))).toBe(false)
  }
  expect(labels.some((l) => l.status === 'review')).toBe(true)
})

test('신뢰도는 숫자 대신 높음/보통/확인 필요로 보인다', () => {
  expect(confidenceLabel('high')).toBe('신뢰도 높음')
  expect(confidenceLabel('medium')).toBe('신뢰도 보통')
  expect(confidenceLabel('low')).toBe('확인 필요')
  expect(confidenceLabel(undefined)).toBe('확인 필요')
})
