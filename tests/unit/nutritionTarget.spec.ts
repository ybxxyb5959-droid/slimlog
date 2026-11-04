import { expect, test } from '@playwright/test'

import { calcTarget } from '../../src/lib/nutritionTarget'

const now = new Date(2026, 10, 4)

test('예시: 여성 1992년생 165cm 80kg 가벼운 활동 → 1,650kcal · 탄 209 · 단 100 · 지 46', () => {
  const r = calcTarget({ sex: 'female', birthYear: 1992, heightCm: 165, weightKg: 80, activity: 'light', now })
  expect(r.age).toBe(34)
  expect(r.bmr).toBe(1500)
  expect(r.tdee).toBe(2063)
  expect([r.kcal, r.carbG, r.proteinG, r.fatG]).toEqual([1650, 209, 100, 46])
  expect(r.activityAssumed).toBe(false)
  expect(r.floored).toBe(false)
})

test('활동량을 안 골랐으면 가장 낮은 활동량으로 가정', () => {
  const r = calcTarget({ sex: 'female', birthYear: 1992, heightCm: 165, weightKg: 80, activity: null, now })
  expect(r.activity).toBe('sedentary')
  expect(r.activityAssumed).toBe(true)
  expect(r.factor).toBe(1.2)
  expect(r.kcal).toBe(1440)
})

test('성별 최저선 아래로는 내려가지 않음', () => {
  const f = calcTarget({ sex: 'female', birthYear: 1960, heightCm: 150, weightKg: 48, activity: null, now })
  expect(f.kcal).toBe(1200)
  expect(f.floored).toBe(true)
  const m = calcTarget({ sex: 'male', birthYear: 1960, heightCm: 160, weightKg: 55, activity: null, now })
  expect(m.kcal).toBe(1500)
  expect(m.floored).toBe(true)
})

test('BMI 30 이상: 단백질은 목표 체중(없으면 BMI 25 체중) 기준', () => {
  const g = calcTarget({ sex: 'female', birthYear: 1990, heightCm: 160, weightKg: 100, goalWeightKg: 75, activity: 'light', now })
  expect(g.proteinBasis).toBe('goal')
  expect(g.proteinG).toBe(94)
  const b = calcTarget({ sex: 'female', birthYear: 1990, heightCm: 160, weightKg: 100, activity: 'light', now })
  expect(b.proteinBasis).toBe('bmi25')
  expect(b.proteinBasisKg).toBe(64)
  expect(b.proteinG).toBe(80)
})

test('탄단지 열량 합은 목표 열량과 거의 같음(반올림 오차 이내)', () => {
  for (const w of [55, 70, 90, 120]) {
    const r = calcTarget({ sex: 'male', birthYear: 1985, heightCm: 175, weightKg: w, activity: 'moderate', now })
    expect(Math.abs(r.carbG * 4 + r.proteinG * 4 + r.fatG * 9 - r.kcal)).toBeLessThanOrEqual(8)
  }
})
