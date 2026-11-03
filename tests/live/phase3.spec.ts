import { expect, test } from '@playwright/test'

import { acceptRequiredConsents, adminDelete, adminInsert, adminSelect, devLogin, quickOnboarding, uniqueEmail, userIdOf } from './helpers'

/** Phase 3 — 서버(FastAPI) 연결: 사진 식단(EXIF 제거·인식·확정·삭제), 탈퇴 */

// 목업 인식기의 food id 와 같은 id 로 테스트용 공용 음식 (실제 영양값 아님)
const FOODS = [
  { food_id: 'kimchi-jjigae', name: 'E2E김치찌개' },
  { food_id: 'rice', name: 'E2E쌀밥' },
  { food_id: 'kimchi', name: 'E2E배추김치' },
  { food_id: 'spinach', name: 'E2E시금치나물' },
].map((f) => ({ ...f, category: '반찬', basis_grams: 100, basis_label: '100g당', serving_g: 100, kcal: 100, data_source: 'E2E 테스트용' }))

test.beforeAll(async () => {
  for (const f of FOODS) await adminInsert('foods', f)
})
test.afterAll(async () => {
  for (const f of FOODS) {
    await adminDelete('meal_items', `food_id=eq.${f.food_id}`)
    await adminDelete('foods', `food_id=eq.${f.food_id}&owner_id=is.null`)
  }
})

/** 작은 JPEG (빨간 1x1 대신 Playwright 로 캔버스에서 만듦) */
async function jpegBuffer(page: import('@playwright/test').Page) {
  const b64 = await page.evaluate(() => {
    const c = document.createElement('canvas')
    c.width = 320
    c.height = 240
    const g = c.getContext('2d')!
    g.fillStyle = '#c4471f'
    g.fillRect(0, 0, 320, 240)
    return c.toDataURL('image/jpeg', 0.9).split(',')[1]
  })
  return Buffer.from(b64, 'base64')
}

test('사진 식단: 업로드 → 서버 인식(목업 모드 표시) → 고르기·빼기 → 확정 저장 → 피드백 기록 → 삭제 시 파일까지', async ({ page }) => {
  const email = uniqueEmail('p3-photo')
  await devLogin(page, email)
  await acceptRequiredConsents(page)
  await quickOnboarding(page)
  const uid = (await userIdOf(email))!

  await page.goto('/record/meal/new')
  await page.getByLabel('갤러리에서 선택').setInputFiles({ name: 'meal.jpg', mimeType: 'image/jpeg', buffer: await jpegBuffer(page) })
  await expect(page).toHaveURL('/record/meal/photo')
  await expect(page.getByText('위치정보(EXIF)를 지운 뒤', { exact: false })).toBeVisible()
  await page.getByRole('button', { name: '음식 인식하기' }).click()
  await expect(page).toHaveURL('/record/meal/review')
  await expect(page.getByText('목업 인식 결과')).toBeVisible() // 모델 없음 → 목업이라고 분명히 표시
  await expect(page.getByText('5개 음식')).toBeVisible()

  const [draft] = await adminSelect('meals', `user_id=eq.${uid}&select=meal_id,status,photo_exif_stripped,photo_path`)
  expect(draft).toMatchObject({ status: 'draft', photo_exif_stripped: true })

  // 확인 필요 1(시금치): 후보에서 고르기 / 확인 필요 2(계란말이, DB 에 없음): 빼기 / 배추김치: 빼기
  await page.getByRole('radiogroup', { name: '확인 필요 1 인식 후보' }).getByRole('radio', { name: 'E2E시금치나물' }).click()
  await page.getByRole('button', { name: '확인 필요 2 제외' }).click()
  await page.getByRole('button', { name: 'E2E배추김치 제외' }).click()
  await expect(page.getByText('3개 음식')).toBeVisible()
  await page.getByRole('button', { name: /식단 저장하기/ }).click()
  await expect(page).toHaveURL('/record/meal')

  await expect.poll(async () => (await adminSelect('meals', `meal_id=eq.${draft.meal_id}&select=status`))[0]?.status).toBe('confirmed')
  const items = await adminSelect('meal_items', `meal_id=eq.${draft.meal_id}&select=name,from_photo&order=sort_order`)
  expect(items.map((i) => i.name)).toEqual(['E2E김치찌개', 'E2E쌀밥', 'E2E시금치나물'])
  expect(items.every((i) => i.from_photo)).toBe(true)
  const preds = await adminSelect('predictions', `meal_id=eq.${draft.meal_id}&select=predicted_food_id,user_action,mode`)
  const act = Object.fromEntries(preds.map((p) => [p.predicted_food_id, p.user_action]))
  expect(act).toEqual({ 'kimchi-jjigae': 'accepted', rice: 'accepted', kimchi: 'excluded', spinach: 'accepted', gyeranmari: 'excluded' })
  expect(new Set(preds.map((p) => p.mode))).toEqual(new Set(['mock']))

  // 새로고침 후 목록 유지 → 삭제(서버 API) → 행·파일 삭제
  await page.reload()
  await expect(page.getByText('사진 1장').first()).toBeVisible()
  await page.getByRole('button', { name: /기록 삭제/ }).first().click()
  await page.getByRole('dialog').getByRole('button', { name: '삭제', exact: true }).click()
  await expect.poll(async () => (await adminSelect('meals', `meal_id=eq.${draft.meal_id}&select=meal_id`)).length).toBe(0)
  const url = process.env.LIVE_SUPABASE_URL!
  const key = process.env.LIVE_SUPABASE_SERVICE_KEY!
  const file = await fetch(`${url}/storage/v1/object/authenticated/meal-photos/${draft.photo_path}`, { headers: { apikey: key, Authorization: `Bearer ${key}` } })
  expect(file.status).toBeGreaterThanOrEqual(400)
})

test('회원 탈퇴: 서버가 계정·기록을 지우고 로그인 화면으로', async ({ page }) => {
  const email = uniqueEmail('p3-bye')
  await devLogin(page, email)
  await acceptRequiredConsents(page)
  await quickOnboarding(page)
  const uid = (await userIdOf(email))!
  await page.goto('/my/account')
  await page.getByRole('button', { name: '회원 탈퇴' }).click()
  await page.getByRole('dialog').getByRole('button', { name: '탈퇴', exact: true }).click()
  await expect(page).toHaveURL('/login')
  expect(await userIdOf(email)).toBeNull()
  expect(await adminSelect('users', `user_id=eq.${uid}&select=user_id`)).toHaveLength(0)
  expect(await adminSelect('body_logs', `user_id=eq.${uid}&select=log_id`)).toHaveLength(0)
})
