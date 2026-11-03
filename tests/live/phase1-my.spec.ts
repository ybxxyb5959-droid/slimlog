import { expect, test } from '@playwright/test'

import { acceptRequiredConsents, adminSelect, devLogin, quickOnboarding, uniqueEmail, userIdOf } from './helpers'

/** Phase 1 — 마이페이지 (프로필·신체 목표·동의 관리) 실제 저장 */

test('프로필: 닉네임 변경 저장, 남이 쓰는 닉네임은 거절, 사용 중인 약 저장', async ({ page, browser }) => {
  // 다른 사용자가 먼저 쓰는 닉네임
  const ctx = await browser.newContext()
  const other = await ctx.newPage()
  await devLogin(other, uniqueEmail('my-other'))
  await acceptRequiredConsents(other)
  const taken = `선점${Date.now() % 100000}`
  await quickOnboarding(other, { nickname: taken })
  await ctx.close()

  const email = uniqueEmail('my-prof')
  await devLogin(page, email)
  await acceptRequiredConsents(page)
  await quickOnboarding(page)
  await page.goto('/my/profile')
  await page.getByLabel(/닉네임/).fill(taken)
  await page.getByRole('radio', { name: '위고비' }).click()
  await page.getByRole('button', { name: '저장' }).click()
  await expect(page.getByText('이미 사용 중인 닉네임이에요.')).toBeVisible()
  const mine = `바뀐${Date.now() % 100000}`
  await page.getByLabel(/닉네임/).fill(mine)
  await page.getByRole('button', { name: '저장' }).click()
  await expect(page).toHaveURL('/my')
  const uid = await userIdOf(email)
  const [u] = await adminSelect('users', `user_id=eq.${uid}&select=nickname`)
  expect(u.nickname).toBe(mine)
  const [h] = await adminSelect('user_health', `user_id=eq.${uid}&select=current_med_id`)
  expect(h.current_med_id).toBe('wegovy')
  await page.reload()
  await page.goto('/my/profile')
  await expect(page.getByLabel(/닉네임/)).toHaveValue(mine)
  await expect(page.getByRole('radio', { name: '위고비' })).toHaveAttribute('aria-checked', 'true')
})

test('신체 정보·목표: 시작 체중을 바꾸면 최초 체중 기록이 고쳐지고 새로 생기지 않음', async ({ page }) => {
  const email = uniqueEmail('my-body')
  await devLogin(page, email)
  await acceptRequiredConsents(page)
  await quickOnboarding(page, { weight: '80', goal: '72' })
  await page.goto('/my/body')
  await page.getByLabel('키').fill('168')
  await page.getByLabel('시작 체중').fill('79.2')
  await page.getByLabel('목표 체중').fill('68')
  await page.getByRole('button', { name: '저장' }).click()
  await expect(page).toHaveURL('/my')
  const uid = await userIdOf(email)
  const [h] = await adminSelect('user_health', `user_id=eq.${uid}&select=height_cm,start_weight_kg,goal_weight_kg`)
  expect([Number(h.height_cm), Number(h.start_weight_kg), Number(h.goal_weight_kg)]).toEqual([168, 79.2, 68])
  const logs = await adminSelect('body_logs', `user_id=eq.${uid}&select=weight_kg,is_baseline`)
  expect(logs).toHaveLength(1)
  expect(Number(logs[0].weight_kg)).toBe(79.2)
})

test('동의 관리: 선택 동의 켜고 끄기 + 민감정보 철회 시 투약 삭제 → 다시 동의해야 사용', async ({ page }) => {
  const email = uniqueEmail('my-consent')
  await devLogin(page, email)
  await acceptRequiredConsents(page)
  await quickOnboarding(page)
  const uid = await userIdOf(email)

  // 투약 하나 기록
  await page.goto('/record/medication/new')
  await page.getByRole('radio', { name: '5 mg', exact: true }).click()
  await page.getByRole('radio', { name: '배 왼쪽' }).click()
  await page.getByRole('button', { name: '저장' }).click()
  await expect(page.getByText('투약 기록을 저장했어요')).toBeVisible()

  // 선택 동의: 이벤트·소식 알림 켰다 끄기
  await page.goto('/my/consent')
  const marketing = page.getByRole('switch', { name: /이벤트·소식 알림/ })
  await marketing.click()
  await expect(marketing).toHaveAttribute('aria-checked', 'true')
  let rows = await adminSelect('consents', `user_id=eq.${uid}&type=eq.marketing&select=withdrawn_at`)
  expect(rows).toHaveLength(1)
  expect(rows[0].withdrawn_at).toBeNull()
  await marketing.click()
  await expect(marketing).toHaveAttribute('aria-checked', 'false')
  rows = await adminSelect('consents', `user_id=eq.${uid}&type=eq.marketing&select=withdrawn_at`)
  expect(rows[0].withdrawn_at).not.toBeNull()

  // 민감정보 철회 → 투약 삭제, 동의 화면으로
  await page.getByRole('switch', { name: /민감정보/ }).click()
  await page.getByRole('dialog').getByRole('button', { name: '철회' }).click()
  await expect(page.getByText('민감정보 동의를 철회했어요')).toBeVisible()
  await expect(page).toHaveURL('/consent')
  expect(await adminSelect('doses', `user_id=eq.${uid}&select=dose_id`)).toHaveLength(0)
  const [h] = await adminSelect('user_health', `user_id=eq.${uid}&select=start_weight_kg`)
  expect(h.start_weight_kg).toBeNull()
  // 이력은 남음
  const hist = await adminSelect('consents', `user_id=eq.${uid}&type=eq.sensitive&select=withdrawn_at`)
  expect(hist.some((r) => r.withdrawn_at !== null)).toBe(true)

  // 홈으로 못 감 → 다시 동의하면 홈
  await page.goto('/home')
  await expect(page).toHaveURL('/consent')
  await page.getByRole('checkbox', { name: '필수 민감정보(건강정보) 처리' }).click()
  for (const n of ['필수 서비스 이용약관', '필수 개인정보 수집·이용']) await page.getByRole('checkbox', { name: n }).click()
  await page.getByRole('button', { name: '동의하고 시작하기' }).click()
  await expect(page).toHaveURL('/home')
  await page.goto('/record/medication')
  await expect(page.getByText(/마운자로 5mg/)).toHaveCount(0)
})
