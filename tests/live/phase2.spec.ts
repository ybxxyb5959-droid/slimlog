import { expect, test, type Page } from '@playwright/test'

import { acceptRequiredConsents, adminSelect, devLogin, quickOnboarding, uniqueEmail, userIdOf } from './helpers'

/** Phase 2 — 체중·체성분 / 증상·컨디션 / 섭취 관리 / 홈 반영 (로컬 Supabase) */

async function newUser(page: Page, tag: string, weight = '80') {
  const email = uniqueEmail(tag)
  await devLogin(page, email)
  await acceptRequiredConsents(page)
  await quickOnboarding(page, { weight, goal: '70' })
  return { email, uid: (await userIdOf(email))! }
}

test('체중·체성분: 추가 → 홈·분석 반영 → 수정 → 삭제, 최초 체중은 삭제 불가, 중복 의심 확인', async ({ page }) => {
  const { uid } = await newUser(page, 'p2-body', '80')
  await page.goto('/record/body')
  await expect(page.getByText('최초 체중')).toBeVisible()

  // 추가 (체성분 포함)
  await page.getByRole('link', { name: '새 기록' }).click()
  await expect(page).toHaveURL('/record/body/new')
  await page.getByLabel('체중', { exact: true }).fill('78.4')
  await page.getByLabel(/골격근량/).fill('30.1')
  await page.getByLabel(/체지방량/).fill('22')
  await page.getByLabel(/체지방률/).fill('28.1')
  await page.getByRole('button', { name: '저장' }).click()
  await expect(page.getByText('체중을 기록했어요')).toBeVisible()
  await expect(page).toHaveURL('/record/body')
  let rows = await adminSelect('body_logs', `user_id=eq.${uid}&select=log_id,weight_kg,skeletal_muscle_kg,body_fat_pct,is_baseline&order=measured_at`)
  expect(rows).toHaveLength(2)
  const added = rows.find((r) => !r.is_baseline)!
  expect([Number(added.weight_kg), Number(added.skeletal_muscle_kg), Number(added.body_fat_pct)]).toEqual([78.4, 30.1, 28.1])

  // 체성분 교차 검증: 체지방량÷체중 vs 체지방률 1% 넘게 다르면 막음
  await page.goto('/record/body/new')
  await page.getByLabel('체중', { exact: true }).fill('78')
  await page.getByLabel(/체지방량/).fill('30')
  await page.getByLabel(/체지방률/).fill('20')
  await page.getByRole('button', { name: '저장' }).click()
  await expect(page.getByRole('alert')).toContainText('1% 넘게')

  // 10분 안 같은 체중 → 중복 의심 확인창
  await page.goto('/record/body/new')
  await page.getByLabel('체중', { exact: true }).fill('78.4')
  await page.getByRole('button', { name: '저장' }).click()
  await expect(page.getByRole('dialog', { name: '비슷한 기록이 이미 있어요' })).toBeVisible()
  await page.getByRole('dialog').getByRole('button', { name: '취소' }).click()

  // 홈: 시작 80 → 최근 78.4 (감량 카드)
  await page.goto('/home')
  await expect(page.getByText('1.6').first()).toBeVisible()

  // 새로고침 후 유지 + 수정
  await page.goto('/record/body')
  await page.reload()
  await page.getByRole('link', { name: /78.4kg 기록 수정/ }).click()
  await page.getByLabel('체중', { exact: true }).fill('78.0')
  await page.getByRole('button', { name: '수정 저장' }).click()
  await expect(page.getByText('체중 기록을 수정했어요')).toBeVisible()
  const [edited] = await adminSelect('body_logs', `log_id=eq.${added.log_id}&select=weight_kg`)
  expect(Number(edited.weight_kg)).toBe(78)

  // 최초 체중은 삭제 버튼 없음
  await page.getByRole('link', { name: /80kg 기록 수정/ }).click()
  await expect(page.getByRole('button', { name: '기록 삭제' })).toHaveCount(0)
  await expect(page.getByText('최초 체중은 삭제할 수 없어요', { exact: false })).toBeVisible()

  // 삭제
  await page.goto(`/record/body/${added.log_id}`)
  await page.getByRole('button', { name: '기록 삭제' }).click()
  await page.getByRole('dialog').getByRole('button', { name: '삭제', exact: true }).click()
  await expect(page.getByText('체중 기록을 삭제했어요')).toBeVisible()
  rows = await adminSelect('body_logs', `user_id=eq.${uid}&select=log_id`)
  expect(rows).toHaveLength(1)
})

test('증상·컨디션: 오늘 컨디션 저장·수정(날짜당 1행), 증상 추가·수정·삭제, 홈 컨디션 완료 표시', async ({ page }) => {
  const { uid } = await newUser(page, 'p2-sym')
  await page.goto('/record/symptom')
  // 오늘 컨디션
  await page.getByRole('radiogroup', { name: '전체 컨디션' }).getByRole('radio', { name: '4' }).click()
  await page.getByRole('radiogroup', { name: '식욕' }).getByRole('radio', { name: '2' }).click()
  await page.getByLabel(/어젯밤 수면/).fill('6.5')
  await page.getByRole('button', { name: '컨디션 저장' }).click()
  await expect(page.getByText('오늘 컨디션을 저장했어요')).toBeVisible()
  await page.getByRole('radiogroup', { name: '전체 컨디션' }).getByRole('radio', { name: '3' }).click()
  await page.getByRole('button', { name: '컨디션 수정' }).click()
  let daily = await adminSelect('daily_checks', `user_id=eq.${uid}&select=condition,appetite,sleep_h`)
  await expect.poll(async () => (daily = await adminSelect('daily_checks', `user_id=eq.${uid}&select=condition,appetite,sleep_h`))[0]?.condition).toBe(3)
  expect(daily).toHaveLength(1)
  expect([daily[0].appetite, Number(daily[0].sleep_h)]).toEqual([2, 6.5])

  // 증상 추가
  await page.getByRole('radiogroup', { name: '증상 선택' }).getByRole('radio', { name: '메스꺼움' }).click()
  await page.getByRole('radiogroup', { name: '강도' }).getByRole('radio', { name: '3' }).click()
  await page.getByLabel(/지속 시간/).fill('2')
  await page.getByLabel(/메모/).fill('저녁 먹고 나서')
  await page.getByRole('button', { name: '증상 저장' }).click()
  await expect(page.getByText('증상을 기록했어요')).toBeVisible()
  let sym = await adminSelect('symptoms', `user_id=eq.${uid}&select=symptom_id,type,severity,duration_h,memo`)
  expect(sym).toHaveLength(1)
  expect(sym[0]).toMatchObject({ type: 'nausea', severity: 3, memo: '저녁 먹고 나서' })

  // 홈: 컨디션 완료
  await page.goto('/home')
  await expect(page.getByRole('link', { name: /컨디션: 기록함/ })).toBeVisible()

  // 수정·삭제
  await page.goto('/record/symptom')
  await page.reload()
  await page.getByRole('link', { name: '메스꺼움 기록 수정' }).click()
  await page.getByRole('radiogroup', { name: '강도' }).getByRole('radio', { name: '5' }).click()
  await page.getByRole('button', { name: '수정 저장' }).click()
  await expect(page.getByText('증상 기록을 수정했어요')).toBeVisible()
  sym = await adminSelect('symptoms', `symptom_id=eq.${sym[0].symptom_id}&select=symptom_id,severity`)
  expect(sym[0].severity).toBe(5)
  await page.getByRole('link', { name: '메스꺼움 기록 수정' }).click()
  await page.getByRole('button', { name: '기록 삭제' }).click()
  await page.getByRole('dialog').getByRole('button', { name: '삭제', exact: true }).click()
  await expect(page.getByText('증상 기록을 삭제했어요')).toBeVisible()
  expect(await adminSelect('symptoms', `user_id=eq.${uid}&select=symptom_id`)).toHaveLength(0)
})

test('섭취 관리: 물·영양제·복용약이 DB 에 저장되고 새로고침 후에도 홈에 남음', async ({ page }) => {
  const { uid } = await newUser(page, 'p2-intake')
  await page.goto('/home')
  await page.getByRole('button', { name: /섭취 관리/ }).click()
  const sheet = page.getByRole('dialog', { name: '섭취 관리' })
  await sheet.getByRole('button', { name: '+250mL' }).click()
  await sheet.getByRole('button', { name: '+250mL' }).click()
  await sheet.getByRole('tab', { name: '영양제' }).click()
  await sheet.getByLabel('영양제 이름').fill('유산균')
  await sheet.getByRole('button', { name: '등록' }).click()
  await sheet.getByRole('button', { name: '섭취 기록' }).click()
  await sheet.getByRole('tab', { name: '복용약' }).click()
  await sheet.getByLabel('복용약 이름').fill('위장약')
  await sheet.getByRole('button', { name: '등록' }).click()
  await sheet.getByRole('button', { name: '복용 기록' }).click()
  await expect.poll(async () => (await adminSelect('intake_logs', `user_id=eq.${uid}&select=log_id`)).length).toBe(4)
  const logs = await adminSelect('intake_logs', `user_id=eq.${uid}&select=kind,amount_ml`)
  expect(logs.filter((l) => l.kind === 'water').reduce((a, l) => a + Number(l.amount_ml), 0)).toBe(500)
  expect(logs.filter((l) => l.kind === 'supplement')).toHaveLength(1)
  expect(logs.filter((l) => l.kind === 'medicine')).toHaveLength(1)
  const items = await adminSelect('intake_items', `user_id=eq.${uid}&select=kind,name`)
  expect(items.map((i) => i.name).sort()).toEqual(['위장약', '유산균'].sort())

  await page.keyboard.press('Escape')
  await page.reload()
  await expect(page.getByRole('button', { name: /섭취 관리/ })).toContainText('물 500mL · 복용 2건')

  // 물 기록 하나 지우기
  await page.getByRole('button', { name: /섭취 관리/ }).click()
  await sheet.getByRole('button', { name: '250mL 기록 삭제' }).first().click()
  await expect.poll(async () => (await adminSelect('intake_logs', `user_id=eq.${uid}&kind=eq.water&select=log_id`)).length).toBe(1)
})
