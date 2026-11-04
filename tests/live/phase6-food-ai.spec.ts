import { expect, test } from '@playwright/test'

import { acceptRequiredConsents, adminDelete, adminInsert, adminSelect, devLogin, quickOnboarding, uniqueEmail, userIdOf } from './helpers'

/**
 * 식단 사진 AI — 실서비스 흐름 (서버 키 없음 → 목업 엔진, 외부 전송 없음)
 * 사진 업로드 → 서버가 음식 이름·추정 인분 반환 → 식약처 DB 이름으로 연결 → 확인·수정 → 저장
 * 영양은 DB 값으로 계산되고, DB 에 없는 음식은 숫자 없이 '확인 필요'로 남는지 확인한다.
 */
const FOODS = [
  { food_id: 'e2e-ai-stew', name: '김치찌개', category: '국·찌개', basis_grams: 400, basis_label: '1그릇(400g)당', serving_g: 400, kcal: 250, carb_g: 12, protein_g: 15, fat_g: 15, data_source: 'E2E 테스트용' },
  { food_id: 'e2e-ai-rice', name: '쌀밥', category: '밥·면', basis_grams: 210, basis_label: '1공기(210g)당', serving_g: 210, kcal: 300, carb_g: 66, protein_g: 5, fat_g: 0.5, data_source: 'E2E 테스트용' },
  { food_id: 'e2e-ai-kimchi', name: '배추김치', category: '반찬', basis_grams: 100, basis_label: '100g당', serving_g: 50, kcal: 18, carb_g: 3.5, protein_g: 1.4, fat_g: 0.4, data_source: 'E2E 테스트용' },
]
const JPEG = Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAA0JCgsKCA0LCgsODg0PEyAVExISEyccHhcgLikxMC4pLSwzOko+MzZGNywtQFdBRkxOUlNSMj5aYVpQYEpRUk//2wBDAQ4ODhMREyYVFSZPNS01T09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0//wAARCAAwAEADASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwCaiiivGPaCiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooA//2Q==', 'base64')

test.beforeAll(async () => {
  for (const f of FOODS) await adminInsert('foods', f)
})
test.afterAll(async () => {
  for (const f of FOODS) {
    await adminDelete('predictions', `predicted_food_id=eq.${f.food_id}`)
    await adminDelete('meal_items', `food_id=eq.${f.food_id}`)
    await adminDelete('foods', `food_id=eq.${f.food_id}`)
  }
})

test('식단 사진: 인식 → DB 연결·신뢰도 표시 → 없는 음식은 확인 필요 → 고치고 저장', async ({ page }) => {
  const email = uniqueEmail('p6-ai')
  await devLogin(page, email)
  await acceptRequiredConsents(page)
  await quickOnboarding(page)
  const uid = (await userIdOf(email))!

  await page.goto('/record/meal/new')
  await page.getByLabel('갤러리에서 선택').setInputFiles({ name: 'meal.jpg', mimeType: 'image/jpeg', buffer: JPEG })
  await expect(page).toHaveURL('/record/meal/photo')
  await expect(page.getByText('Google Gemini로 전송돼요')).toBeVisible()
  await page.getByRole('button', { name: '음식 인식하기' }).click()
  await expect(page).toHaveURL('/record/meal/review')

  // 확실하고 DB 에 있는 음식은 바로 담김 (DB 기본 제공량 × 1인분)
  const items = page.getByRole('listitem')
  const stew = items.filter({ hasText: '김치찌개' }).first()
  await expect(stew.getByText('신뢰도 높음')).toBeVisible()
  await expect(stew.getByText('250kcal')).toBeVisible()
  // DB 에 없는 음식 → 영양 숫자 없이 확인 필요
  const spinach = items.filter({ hasText: '시금치나물?' })
  await expect(spinach.getByText('영양 DB에 없는 음식이에요')).toBeVisible()
  await expect(page.getByText('참고용 추정값')).toBeVisible()

  // 배추김치(보통): 후보에서 고르기 / 없는 음식 2개는 빼기
  const kimchi = items.filter({ hasText: '배추김치?' })
  await kimchi.getByRole('radio', { name: '배추김치' }).click()
  await page.getByRole('button', { name: '확인 필요 2 제외' }).click()
  await page.getByRole('button', { name: '확인 필요 2 제외' }).click()
  await page.getByRole('button', { name: /식단 저장하기/ }).click()
  await expect(page).toHaveURL('/record/meal')

  const meals = await adminSelect('meals', `user_id=eq.${uid}&select=meal_id,status,source`)
  expect(meals).toHaveLength(1)
  expect(meals[0]).toMatchObject({ status: 'confirmed', source: 'photo' })
  const saved = await adminSelect('meal_items', `meal_id=eq.${meals[0].meal_id}&select=food_id,grams,kcal&order=food_id`)
  expect(saved).toEqual([
    { food_id: 'e2e-ai-kimchi', grams: 50, kcal: 9 },
    { food_id: 'e2e-ai-rice', grams: 210, kcal: 300 },
    { food_id: 'e2e-ai-stew', grams: 400, kcal: 250 },
  ])
  const preds = await adminSelect('predictions', `meal_id=eq.${meals[0].meal_id}&select=predicted_name,predicted_food_id,user_action`)
  expect(preds.find((p: { predicted_name: string }) => p.predicted_name === '시금치나물')).toMatchObject({ predicted_food_id: null, user_action: 'excluded' })
  // 목업 엔진은 외부로 안 보내므로 사용량 기록 없음
  expect(await adminSelect('ai_requests', `user_id=eq.${uid}&select=req_id`)).toHaveLength(0)
})
