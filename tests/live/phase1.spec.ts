import { expect, test } from '@playwright/test'

import { acceptRequiredConsents, adminSelect, devLogin, quickOnboarding, uniqueEmail, userIdOf } from './helpers'

/**
 * Phase 1 — 실제 인증·DB 연결 (로컬 Supabase)
 * 화면 확인 + service_role 로 DB 를 직접 조회해 '정말 저장됐는지'를 같이 본다.
 */

test('로그인 안 하면 앱 화면에 못 들어가고 로그인으로 보낸다', async ({ page }) => {
  for (const path of ['/home', '/record/medication', '/my', '/consent', '/onboarding']) {
    await page.goto(path)
    await expect(page).toHaveURL('/login')
  }
})

test('연결 안 된 소셜 로그인은 성공한 척하지 않는다 (준비 중 안내)', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByText('준비 중 · 아직 연결되지 않았어요').first()).toBeVisible()
  await page.getByRole('button', { name: '카카오 로그인' }).click()
  await expect(page.getByText('아직 연결되지 않은 로그인이에요')).toBeVisible()
  await expect(page).toHaveURL('/login')
  await expect(page.getByText('UI 목업')).toHaveCount(0)
})

test('가입 → 동의 저장 → 온보딩(닉네임·신체정보) → 홈 → 새로고침해도 유지', async ({ page }) => {
  const email = uniqueEmail('p1-onb')
  await devLogin(page, email)
  // 필수 동의 전에는 온보딩·홈으로 못 감
  await expect(page).toHaveURL('/consent')
  await page.goto('/home')
  await expect(page).toHaveURL('/consent')
  await acceptRequiredConsents(page)

  const nickname = `테스트${Date.now() % 100000}`
  await quickOnboarding(page, { nickname, weight: '81.5', goal: '70' })
  await expect(page.getByText('81.5').first()).toBeVisible()

  // DB 에 실제로 저장됐는지
  const uid = await userIdOf(email)
  expect(uid).toBeTruthy()
  const [u] = await adminSelect('users', `user_id=eq.${uid}&select=nickname,onboarding_completed_at`)
  expect(u.nickname).toBe(nickname)
  expect(u.onboarding_completed_at).toBeTruthy()
  const [h] = await adminSelect('user_health', `user_id=eq.${uid}&select=start_weight_kg,goal_weight_kg,legal_name`)
  expect(Number(h.start_weight_kg)).toBe(81.5)
  expect(Number(h.goal_weight_kg)).toBe(70)
  const consents = await adminSelect('consents', `user_id=eq.${uid}&select=type`)
  expect(consents.map((c) => c.type).sort()).toEqual(['privacy', 'sensitive', 'terms'])
  const baseline = await adminSelect('body_logs', `user_id=eq.${uid}&is_baseline=eq.true&select=weight_kg`)
  expect(baseline).toHaveLength(1)

  // 새로고침 → 세션 유지, 온보딩 다시 안 함
  await page.reload()
  await expect(page).toHaveURL('/home')
  await page.goto('/onboarding')
  await expect(page).toHaveURL('/home')
})

test('온보딩 첫 투약 저장 → 투약 추가·수정·삭제가 DB 에 반영되고 새로고침 후에도 유지', async ({ page }) => {
  const email = uniqueEmail('p1-dose')
  await devLogin(page, email)
  await acceptRequiredConsents(page)
  await expect(page.getByText('사용할 수 있는 닉네임이에요.')).toBeVisible()
  await page.getByRole('button', { name: '이 닉네임으로 계속하기' }).click()
  await page.getByRole('button', { name: '나중에 입력' }).click()
  await page.getByRole('radio', { name: /지금 투약 내역 기록하기/ }).click()
  await page.getByRole('button', { name: '투약 기록 시작하기' }).click()
  const sheet = page.getByRole('dialog')
  await sheet.getByRole('radio', { name: /마운자로/ }).click()
  await sheet.getByRole('button', { name: '다음', exact: true }).click()
  await sheet.getByRole('radio', { name: '배 왼쪽' }).click()
  await sheet.getByRole('button', { name: '다음', exact: true }).click()
  await sheet.getByRole('button', { name: '어제', exact: true }).click()
  await sheet.getByRole('checkbox', { name: /시간이 기억나지 않아요/ }).check()
  await sheet.getByRole('button', { name: '다음', exact: true }).click()
  await sheet.getByRole('button', { name: '확인', exact: true }).click()
  await expect(sheet.getByText('투약 기록을 남겼어요')).toBeVisible()
  await sheet.getByRole('button', { name: '닫기', exact: true }).first().click()
  await expect(page).toHaveURL('/home')

  const uid = await userIdOf(email)
  let doses = await adminSelect('doses', `user_id=eq.${uid}&select=dose_id,med_id,dose_mg,site,time_unknown`)
  expect(doses).toHaveLength(1)
  expect(doses[0]).toMatchObject({ med_id: 'mounjaro', site: 'abdomen_left', time_unknown: true })

  // 새로고침 후 목록에 그대로
  await page.goto('/record/medication')
  await page.reload()
  await expect(page.getByText('마운자로 2.5mg').first()).toBeVisible()

  // 추가
  await page.goto('/record/medication/new')
  await page.getByRole('radio', { name: '위고비' }).click()
  await page.getByRole('radio', { name: '0.5 mg', exact: true }).click()
  await page.getByRole('radio', { name: '배 오른쪽' }).click()
  await page.getByRole('button', { name: '저장' }).click()
  await expect(page).toHaveURL('/record/medication')
  await expect(page.getByText('투약 기록을 저장했어요')).toBeVisible()
  doses = await adminSelect('doses', `user_id=eq.${uid}&select=dose_id,med_id,dose_mg`)
  expect(doses).toHaveLength(2)
  const wegovy = doses.find((d) => d.med_id === 'wegovy')!
  expect(Number(wegovy.dose_mg)).toBe(0.5)

  // 수정
  await page.goto(`/record/medication/${wegovy.dose_id}`)
  await page.getByRole('radio', { name: '1 mg', exact: true }).click()
  await page.getByRole('button', { name: '수정 저장' }).click()
  await expect(page.getByText('투약 기록을 수정했어요')).toBeVisible()
  const [edited] = await adminSelect('doses', `dose_id=eq.${wegovy.dose_id}&select=dose_mg`)
  expect(Number(edited.dose_mg)).toBe(1)

  // 삭제
  await page.goto(`/record/medication/${wegovy.dose_id}`)
  await page.getByRole('button', { name: '기록 삭제' }).click()
  await page.getByRole('dialog').getByRole('button', { name: '삭제', exact: true }).click()
  await expect(page.getByText('투약 기록을 삭제했어요')).toBeVisible()
  expect(await adminSelect('doses', `dose_id=eq.${wegovy.dose_id}&select=dose_id`)).toHaveLength(0)
  await page.reload()
  await expect(page.getByText(/위고비/)).toHaveCount(0)
})

test('사용자 간 데이터 분리 + 닉네임 중복 차단 + 로그아웃', async ({ page, browser }) => {
  // A: 가입·투약
  const emailA = uniqueEmail('p1-a')
  await devLogin(page, emailA)
  await acceptRequiredConsents(page)
  const nickA = `중복${Date.now() % 100000}`
  await quickOnboarding(page, { nickname: nickA })
  await page.goto('/record/medication/new')
  await page.getByRole('radio', { name: '마운자로' }).click()
  await page.getByRole('radio', { name: '5 mg', exact: true }).click()
  await page.getByRole('radio', { name: '배 왼쪽' }).click()
  await page.getByRole('button', { name: '저장' }).click()
  await expect(page.getByText('투약 기록을 저장했어요')).toBeVisible()

  // B: 다른 브라우저 — A 의 닉네임은 못 쓰고, A 의 투약은 안 보임
  const ctxB = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const pageB = await ctxB.newPage()
  await devLogin(pageB, uniqueEmail('p1-b'))
  await acceptRequiredConsents(pageB)
  await pageB.getByLabel('나의 닉네임').fill(nickA)
  await expect(pageB.getByText('이미 사용 중인 닉네임이에요.', { exact: false })).toBeVisible()
  await quickOnboarding(pageB, { nickname: `다른${Date.now() % 100000}` })
  await pageB.goto('/record/medication')
  await expect(pageB.getByText(/마운자로 5mg/)).toHaveCount(0)
  await ctxB.close()

  // A 로그아웃 → 보호 화면 차단
  await page.goto('/my/settings')
  await page.getByRole('button', { name: '로그아웃' }).click()
  await page.getByRole('dialog').getByRole('button', { name: '로그아웃', exact: true }).click()
  await expect(page).toHaveURL('/login')
  await page.goto('/home')
  await expect(page).toHaveURL('/login')
  // 다시 로그인하면 기록 그대로
  await devLogin(page, emailA)
  await expect(page).toHaveURL('/home')
  await page.goto('/record/medication')
  await expect(page.getByText('마운자로 5mg').first()).toBeVisible()
})
