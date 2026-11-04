import { expect, test } from '@playwright/test'

import { acceptRequiredConsents, adminDelete, adminInsert, adminSelect, devLogin, quickOnboarding, uniqueEmail, userIdOf } from './helpers'

/** Phase 2 — 식단 (공용 음식 검색·내 음식·식사 저장/수정/삭제) */

const PUBLIC_FOOD = { food_id: 'e2e-public-rice', name: 'E2E공용쌀밥', brand: 'E2E브랜드', category: '밥·면', basis_grams: 210, basis_label: '1공기(210g)당', serving_g: 210, kcal: 300, carb_g: 66, protein_g: 5, fat_g: 0.5, data_source: 'E2E 테스트용 (실제 영양값 아님)' }

test.beforeAll(async () => adminInsert('foods', PUBLIC_FOOD))
test.afterAll(async () => {
  await adminDelete('meal_items', `food_id=eq.${PUBLIC_FOOD.food_id}`)
  await adminDelete('foods', `food_id=eq.${PUBLIC_FOOD.food_id}`)
})

test('식단: 공용 음식 서버 검색 + 내 음식 등록 → 한 끼 저장 → 수정 → 삭제, 새로고침 유지, 다른 사람 내 음식 안 보임', async ({ page, browser }) => {
  const email = uniqueEmail('p2-meal')
  await devLogin(page, email)
  await acceptRequiredConsents(page)
  await quickOnboarding(page)
  const uid = (await userIdOf(email))!

  // 실서비스에서 예시(가짜) 사진으로는 기록을 만들지 않음
  await page.goto('/record/meal/new')
  await expect(page.getByRole('button', { name: '예시 사진' })).toHaveCount(0)
  await expect(page).toHaveURL('/record/meal/new')

  // 공용 음식: 서버에서 검색 → 1인분 바로 담기
  await page.goto('/record/meal/search')
  await page.getByLabel('음식 검색').fill('E2E공용')
  await page.getByRole('button', { name: 'E2E공용쌀밥 1회분 바로 추가' }).click()

  // 브랜드명만 쳐도 검색됨
  await page.getByLabel('음식 검색').fill('E2E브랜드')
  await expect(page.getByRole('button', { name: 'E2E공용쌀밥 1회분 바로 추가' })).toBeVisible()

  // 내 음식 등록 → 담기
  await page.getByLabel('음식 검색').fill('엄마표곤드레밥')
  await page.getByRole('button', { name: '직접 음식 등록하기' }).click()
  await page.getByLabel(/기준 제공량/).fill('250')
  await page.getByLabel(/^칼로리/).fill('380')
  await page.getByRole('button', { name: '내 음식으로 등록' }).click()
  await page.getByRole('button', { name: '식단에 추가' }).click()
  await expect(page).toHaveURL('/record/meal/review')
  await expect(page.getByText('2개 음식')).toBeVisible()
  await page.getByRole('radio', { name: '점심' }).click()
  await page.getByRole('button', { name: /식단 저장하기/ }).click()
  await expect(page).toHaveURL('/record/meal')

  await expect.poll(async () => (await adminSelect('meals', `user_id=eq.${uid}&select=meal_id`)).length).toBe(1)
  const [meal] = await adminSelect('meals', `user_id=eq.${uid}&select=meal_id,meal_type,source`)
  expect(meal).toMatchObject({ meal_type: 'lunch', source: 'manual' })
  const items = await adminSelect('meal_items', `meal_id=eq.${meal.meal_id}&select=name,kcal,food_id&order=sort_order`)
  expect(items.map((i) => i.name)).toEqual(['E2E공용쌀밥', '엄마표곤드레밥'])
  expect(Number(items[0].kcal)).toBe(300)
  const myFoods = await adminSelect('foods', `owner_id=eq.${uid}&select=food_id,name`)
  expect(myFoods.map((f) => f.name)).toEqual(['엄마표곤드레밥'])

  // 새로고침 후 유지 → 수정(음식 하나 빼기)
  await page.reload()
  const card = page.getByRole('region', { name: /^점심 .* 식사 기록$/ }).first()
  await expect(card).toContainText('엄마표곤드레밥')
  await page.getByRole('button', { name: /^점심 .* 기록 수정/ }).first().click()
  await page.getByRole('button', { name: '엄마표곤드레밥 제외' }).click()
  await page.getByRole('button', { name: /식단 수정하기/ }).click()
  await expect.poll(async () => (await adminSelect('meal_items', `meal_id=eq.${meal.meal_id}&select=name`)).map((i) => i.name)).toEqual(['E2E공용쌀밥'])

  // 다른 사용자: 내 음식 검색 안 됨
  const ctx = await browser.newContext()
  const other = await ctx.newPage()
  await devLogin(other, uniqueEmail('p2-meal-b'))
  await acceptRequiredConsents(other)
  await quickOnboarding(other)
  await other.goto('/record/meal/search')
  await other.getByLabel('음식 검색').fill('엄마표곤드레밥')
  await expect(other.getByText('찾으시는 음식이 없나요?')).toBeVisible()
  await other.goto('/record/meal')
  await expect(other.getByText('E2E공용쌀밥')).toHaveCount(0)
  await ctx.close()

  // 삭제
  await page.goto('/record/meal')
  await page.getByRole('button', { name: /^점심 .* 기록 삭제/ }).first().click()
  await page.getByRole('dialog').getByRole('button', { name: '삭제', exact: true }).click()
  await expect.poll(async () => (await adminSelect('meals', `user_id=eq.${uid}&select=meal_id`)).length).toBe(0)
  await page.reload()
  await expect(page.getByRole('region', { name: /^점심 .* 식사 기록$/ })).toHaveCount(0)
})
