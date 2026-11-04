import { expect, test } from '@playwright/test'

import { calcTarget } from '../../src/lib/nutritionTarget'

const now = new Date(2026, 10, 4)

test('예시: 여성 1992년생 165cm 80kg 가벼운 활동 → 감량 1,440kcal (유지 2,063에서 30% 상한까지 줄임)', () => {
  const r = calcTarget({ sex: 'female', birthYear: 1992, heightCm: 165, weightKg: 80, activity: 'light', now })
  expect(r.age).toBe(34)
  expect(r.bmr).toBe(1500)
  expect(r.tdee).toBe(2063)
  expect(r.mode).toBe('lose')
  expect(r.deficitByRate).toBe(660) // 80 × 0.75% × 7700 ÷ 7
  expect(r.deficitCapped).toBe(true) // 2063 × 30% = 619
  // BMI 29.4 → 단백질은 BMI 25 체중(68.1kg) × 1.3
  expect([r.kcal, r.carbG, r.proteinG, r.fatG]).toEqual([1440, 181, 89, 40])
  expect(r.weeklyLossKg).toBe(0.6)
  expect(r.floored).toBe(false)
})

test('감량 열량은 항상 유지 열량보다 낮다 (다이어트 기준)', () => {
  for (const w of [60, 75, 90, 110]) {
    const r = calcTarget({ sex: 'male', birthYear: 1990, heightCm: 175, weightKg: w, activity: 'moderate', now })
    expect(r.kcal).toBeLessThan(r.tdee - 250)
    expect(r.deficit).toBeLessThanOrEqual(Math.round(r.tdee * 0.3) + 5)
  }
})

test('목표 체중까지 예상 주 수', () => {
  const r = calcTarget({ sex: 'female', birthYear: 1992, heightCm: 165, weightKg: 80, goalWeightKg: 68, activity: 'light', now })
  expect(r.weeksToGoal).toBe(Math.ceil(12 / r.weeklyLossKg))
  expect(r.proteinBasis).toBe('goal')
  expect(r.proteinG).toBe(88) // 68 × 1.3
})

test('이미 목표 체중이면 유지 열량', () => {
  const r = calcTarget({ sex: 'female', birthYear: 1992, heightCm: 165, weightKg: 58, goalWeightKg: 58, activity: 'light', now })
  expect(r.mode).toBe('maintain')
  expect(r.kcal).toBe(Math.round(r.tdee / 10) * 10)
  expect(r.weeksToGoal).toBeNull()
})

test('활동량을 안 골랐으면 가장 낮은 활동량으로 가정', () => {
  const r = calcTarget({ sex: 'female', birthYear: 1992, heightCm: 165, weightKg: 80, activity: null, now })
  expect(r.activity).toBe('sedentary')
  expect(r.activityAssumed).toBe(true)
  expect(r.factor).toBe(1.2)
  expect(r.kcal).toBe(1260) // 1800 − 30%(540)
})

test('성별 최저선 아래로는 내려가지 않음', () => {
  const f = calcTarget({ sex: 'female', birthYear: 1960, heightCm: 150, weightKg: 48, activity: null, now })
  expect(f.kcal).toBe(1200)
  expect(f.floored).toBe(true)
  const m = calcTarget({ sex: 'male', birthYear: 1960, heightCm: 160, weightKg: 55, activity: null, now })
  expect(m.kcal).toBe(1500)
  expect(m.floored).toBe(true)
})

test('단백질 최소 60g, BMI 25 이상은 기준 체중을 낮춰서', () => {
  const small = calcTarget({ sex: 'female', birthYear: 1990, heightCm: 150, weightKg: 42, activity: 'light', now })
  expect(small.proteinG).toBe(60)
  const b = calcTarget({ sex: 'female', birthYear: 1990, heightCm: 160, weightKg: 100, activity: 'light', now })
  expect(b.proteinBasis).toBe('bmi25')
  expect(b.proteinBasisKg).toBe(64)
  expect(b.proteinG).toBe(83)
})

test('탄단지 열량 합은 목표 열량과 거의 같음(반올림 오차 이내)', () => {
  for (const w of [55, 70, 90, 120]) {
    const r = calcTarget({ sex: 'male', birthYear: 1985, heightCm: 175, weightKg: w, activity: 'moderate', now })
    expect(Math.abs(r.carbG * 4 + r.proteinG * 4 + r.fatG * 9 - r.kcal)).toBeLessThanOrEqual(8)
  }
})
