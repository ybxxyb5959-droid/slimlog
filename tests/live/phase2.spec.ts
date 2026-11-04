import { expect, test, type Page } from '@playwright/test'

import { acceptRequiredConsents, adminInsert, adminSelect, devLogin, quickOnboarding, uniqueEmail, userIdOf } from './helpers'

/** Phase 2 — 체중·체성분 / 증상·컨디션 / 섭취 관리 / 홈 반영 (로컬 Supabase) */

async function newUser(page: Page, tag: string, weight = '80') {
  const email = uniqueEmail(tag)
  await devLogin(page, email)
  await acceptRequiredConsents(page)
  await quickOnboarding(page, { weight, goal: '70' })
  return { email, uid: (await userIdOf(email))! }
}

test('체중: 체중만 추가 → 홈 반영 → 수정 → 삭제, 최초 체중 삭제 불가, 중복 의심, 인바디 기록 체성분 유지', async ({ page }) => {
  const { uid } = await newUser(page, 'p2-body', '80')
  await page.goto('/record/body')
  await expect(page.getByText('최초 체중')).toBeVisible()

  // 추가 — 매일 기록은 체중만 (체성분 칸 없음)
  await page.getByRole('link', { name: '새 기록' }).click()
  await expect(page).toHaveURL('/record/body/new')
  await expect(page.getByLabel(/골격근량/)).toHaveCount(0)
  await page.getByLabel('체중', { exact: true }).fill('78.4')
  await page.getByRole('button', { name: '저장' }).click()
  await expect(page.getByText('체중을 기록했어요')).toBeVisible()
  await expect(page).toHaveURL('/record/body')
  let rows = await adminSelect('body_logs', `user_id=eq.${uid}&select=log_id,weight_kg,skeletal_muscle_kg,is_baseline&order=measured_at`)
  expect(rows).toHaveLength(2)
  const added = rows.find((r) => !r.is_baseline)!
  expect([Number(added.weight_kg), added.skeletal_muscle_kg]).toEqual([78.4, null])

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

  // 인바디로 저장된 기록: 체중만 고쳐도 체성분은 유지
  await adminInsert('body_logs', { user_id: uid, measured_at: new Date(Date.now() - 3 * 86_400_000).toISOString(), weight_kg: 79.2, skeletal_muscle_kg: 33.9, body_fat_pct: 24.6, source: 'INBODY_OCR', is_verified: true })
  await page.goto('/record/body') // 새로 들어오면서 DB 에서 다시 불러옴
  await page.getByRole('link', { name: /79.2kg 기록 수정/ }).click()
  await expect(page.getByText('체성분(인바디)은 그대로 유지돼요', { exact: false })).toBeVisible()
  await page.getByLabel('체중', { exact: true }).fill('79.0')
  await page.getByRole('button', { name: '수정 저장' }).click()
  await expect(page.getByText('체중 기록을 수정했어요')).toBeVisible()
  const [ocr] = await adminSelect('body_logs', `user_id=eq.${uid}&source=eq.INBODY_OCR&select=weight_kg,skeletal_muscle_kg,body_fat_pct`)
  expect([Number(ocr.weight_kg), Number(ocr.skeletal_muscle_kg), Number(ocr.body_fat_pct)]).toEqual([79, 33.9, 24.6])

  // 삭제
  await page.goto(`/record/body/${added.log_id}`)
  await page.getByRole('button', { name: '기록 삭제' }).click()
  await page.getByRole('dialog').getByRole('button', { name: '삭제', exact: true }).click()
  await expect(page.getByText('체중 기록을 삭제했어요')).toBeVisible()
  rows = await adminSelect('body_logs', `user_id=eq.${uid}&select=log_id`)
  expect(rows).toHaveLength(2) // 최초 체중 + 인바디 기록
})

test('증상·컨디션: 오늘 컨디션 저장·수정(날짜당 1행), 증상 추가·수정·삭제, 홈 컨디션 완료 표시', async ({ page }) => {
  const { uid } = await newUser(page, 'p2-sym')
  await page.goto('/record/symptom')
  // 오늘 컨디션 — 얼굴 5단계 · 식욕 · 수면 슬라이더
  await page.getByRole('radiogroup', { name: '오늘 몸 상태' }).getByRole('radio', { name: '좋음', exact: true }).click()
  await page.getByRole('radiogroup', { name: '식욕' }).getByRole('radio', { name: '적음' }).click()
  await page.getByRole('slider', { name: '수면 시간' }).press('ArrowLeft') // 기본 7 → 6.5
  await expect(page.getByText('6.5시간')).toBeVisible()
  await page.getByRole('button', { name: '컨디션 저장' }).click()
  await expect(page.getByText('오늘 컨디션을 저장했어요')).toBeVisible()
  await page.getByRole('radiogroup', { name: '오늘 몸 상태' }).getByRole('radio', { name: '보통' }).click()
  await page.getByRole('button', { name: '컨디션 수정' }).click()
  let daily = await adminSelect('daily_checks', `user_id=eq.${uid}&select=condition,appetite,sleep_h`)
  await expect.poll(async () => (daily = await adminSelect('daily_checks', `user_id=eq.${uid}&select=condition,appetite,sleep_h`))[0]?.condition).toBe(3)
  expect(daily).toHaveLength(1)
  expect([daily[0].appetite, Number(daily[0].sleep_h)]).toEqual([2, 6.5])
  await expect(page.getByText('오늘 기록', { exact: true })).toBeVisible()

  // 증상 — 여러 개 고르고 고른 것마다 강도·지속
  await page.getByRole('group', { name: '증상 선택' }).getByRole('button', { name: '메스꺼움' }).click()
  await page.getByRole('group', { name: '증상 선택' }).getByRole('button', { name: '두통' }).click()
  await page.getByRole('radiogroup', { name: '두통 강도' }).getByRole('radio', { name: '약함' }).click()
  await page.getByRole('radiogroup', { name: '메스꺼움 지속' }).getByRole('radio', { name: '1~3시간' }).click()
  await page.getByLabel('추가 메모').fill('저녁 먹고 나서')
  await page.getByRole('button', { name: '증상 2개 저장' }).click()
  await expect(page.getByText('증상 2개를 기록했어요')).toBeVisible()
  let sym = await adminSelect('symptoms', `user_id=eq.${uid}&select=symptom_id,type,severity,duration_h,memo&order=type`)
  expect(sym).toHaveLength(2)
  expect(sym.find((x) => x.type === 'nausea')).toMatchObject({ severity: 3, memo: '저녁 먹고 나서' })
  expect(Number(sym.find((x) => x.type === 'nausea')!.duration_h)).toBe(2)
  expect(sym.find((x) => x.type === 'headache')).toMatchObject({ severity: 1 })
  sym = sym.filter((x) => x.type === 'nausea')

  // 홈: 컨디션 완료
  await page.goto('/home')
  await expect(page.getByRole('link', { name: /컨디션: 기록함/ })).toBeVisible()

  // 수정·삭제
  await page.goto('/record/symptom')
  await page.reload()
  await page.getByRole('link', { name: '메스꺼움 기록 수정' }).click()
  // 수정 화면도 빠른 기록과 같은 모양: 강도 약함/보통/심함, 지속 중은 메모 앞 표시로 저장
  await expect(page.getByRole('radiogroup', { name: '메스꺼움 지속' }).getByRole('radio', { name: '1~3시간' })).toHaveAttribute('aria-checked', 'true')
  await page.getByRole('radiogroup', { name: '메스꺼움 강도' }).getByRole('radio', { name: '심함' }).click()
  await page.getByRole('radiogroup', { name: '메스꺼움 지속' }).getByRole('radio', { name: '지속 중' }).click()
  await page.getByRole('button', { name: '수정 저장' }).click()
  await expect(page.getByText('증상 기록을 수정했어요')).toBeVisible()
  sym = await adminSelect('symptoms', `symptom_id=eq.${sym[0].symptom_id}&select=symptom_id,severity,duration_h,memo`)
  expect(sym[0]).toMatchObject({ severity: 5, duration_h: null, memo: '지속 중 · 저녁 먹고 나서' })
  await page.getByRole('link', { name: '메스꺼움 기록 수정' }).click()
  await page.getByRole('button', { name: '기록 삭제' }).click()
  await page.getByRole('dialog').getByRole('button', { name: '삭제', exact: true }).click()
  await expect(page.getByText('증상 기록을 삭제했어요')).toBeVisible()
  expect(await adminSelect('symptoms', `user_id=eq.${uid}&select=symptom_id`)).toHaveLength(1) // 두통만 남음
})

test('섭취 관리: 물·영양제·복용약이 DB 에 저장되고 새로고침 후에도 홈에 남음', async ({ page }) => {
  const { uid } = await newUser(page, 'p2-intake')
  await page.goto('/home')
  await page.getByRole('button', { name: /섭취 관리/ }).click()
  const sheet = page.getByRole('dialog', { name: '섭취 관리' })
  await sheet.getByRole('button', { name: '+250mL' }).click()
  await sheet.getByRole('button', { name: '+250mL' }).click()
  // 영양제: [+ 등록] → '유' 입력 → 자동완성(최대 5개)에서 고르기
  await sheet.getByRole('tab', { name: '영양제' }).click()
  await sheet.getByRole('button', { name: '등록' }).click()
  await sheet.getByLabel('영양제 이름').fill('유')
  const hints = sheet.getByRole('listbox', { name: '영양제 추천' }).getByRole('option')
  expect(await hints.count()).toBeLessThanOrEqual(5)
  await sheet.getByRole('button', { name: '유산균(프로바이오틱스)' }).click()
  // 카드 눌러 섭취 완료 → 처음이면 매일 알림 물어봄 → 확인 → 시계로 시 고르기
  await sheet.getByRole('button', { name: '유산균(프로바이오틱스) 섭취 완료' }).click()
  await expect(page.getByRole('dialog', { name: '매일 알림을 보내드릴게요' })).toBeVisible()
  await page.getByRole('dialog', { name: '매일 알림을 보내드릴게요' }).getByRole('button', { name: '확인' }).click()
  const clock = page.getByRole('slider', { name: '알림 시각' })
  await clock.focus()
  await clock.press('ArrowRight')
  const hourNow = Number(await clock.getAttribute('aria-valuenow'))
  await page.getByRole('dialog', { name: '알림 시간' }).getByRole('button', { name: '저장' }).click()
  await expect.poll(async () => (await adminSelect('intake_items', `user_id=eq.${uid}&kind=eq.supplement&select=remind_enabled,remind_hour,remind_asked`))[0]).toEqual({ remind_enabled: true, remind_hour: hourNow, remind_asked: true })

  // 복용약: 직접 입력 등록 → 섭취 완료 → '알림받지 않기' → 다시 안 물음
  await sheet.getByRole('tab', { name: '복용약' }).click()
  await sheet.getByRole('button', { name: '등록' }).click()
  await sheet.getByLabel('복용약 이름').fill('위장약')
  await sheet.getByRole('button', { name: '등록하기' }).click()
  await sheet.getByRole('button', { name: '위장약 복용 완료' }).click()
  await page.getByRole('dialog', { name: '매일 알림을 보내드릴게요' }).getByRole('button', { name: '알림받지 않기' }).click()
  await expect.poll(async () => (await adminSelect('intake_items', `user_id=eq.${uid}&kind=eq.medicine&select=remind_enabled,remind_asked`))[0]).toEqual({ remind_enabled: false, remind_asked: true })
  await expect.poll(async () => (await adminSelect('intake_logs', `user_id=eq.${uid}&select=log_id`)).length).toBe(4)
  const logs = await adminSelect('intake_logs', `user_id=eq.${uid}&select=kind,amount_ml,status`)
  expect(logs.filter((l) => l.kind === 'water').reduce((a, l) => a + Number(l.amount_ml), 0)).toBe(500)
  expect(logs.filter((l) => l.kind === 'supplement')).toEqual([{ kind: 'supplement', amount_ml: null, status: 'taken' }])
  expect(logs.filter((l) => l.kind === 'medicine')).toHaveLength(1)
  const items = await adminSelect('intake_items', `user_id=eq.${uid}&select=kind,name`)
  expect(items.map((i) => i.name).sort()).toEqual(['위장약', '유산균(프로바이오틱스)'].sort())

  await page.keyboard.press('Escape')
  await page.reload()
  await expect(page.getByRole('button', { name: /섭취 관리/ })).toContainText('물 500mL · 복용 2건')

  // 물 기록 하나 지우기
  await page.getByRole('button', { name: /섭취 관리/ }).click()
  await sheet.getByRole('button', { name: '250mL 기록 삭제' }).first().click()
  await expect.poll(async () => (await adminSelect('intake_logs', `user_id=eq.${uid}&kind=eq.water&select=log_id`)).length).toBe(1)
})

test('기록 목표: 단백질·물 목표가 user_health 에 저장되고 새로고침 후 섭취 관리·식단 분석에 쓰임', async ({ page }) => {
  const { uid } = await newUser(page, 'p2-goal')
  await page.goto('/my/settings/app')
  await expect(page.getByLabel('하루 단백질 목표')).toHaveValue('')
  await expect(page.getByLabel('하루 물 목표')).toHaveValue('8')
  await page.getByLabel('하루 물 목표').fill('30')
  await expect(page.getByRole('alert')).toHaveText(/1~24컵/)
  await expect(page.getByRole('button', { name: '저장' })).toBeDisabled()
  await page.getByLabel('하루 물 목표').fill('6')
  await page.getByLabel('하루 단백질 목표').fill('90')
  await page.getByRole('button', { name: '저장' }).click()
  await expect(page.getByText('목표를 저장했어요')).toBeVisible()
  const h = await adminSelect('user_health', `user_id=eq.${uid}&select=protein_goal_g,water_goal_ml`)
  expect(h[0]).toEqual({ protein_goal_g: 90, water_goal_ml: 1500 })

  await page.reload()
  await expect(page.getByLabel('하루 단백질 목표')).toHaveValue('90')
  await page.goto('/record/daily')
  await expect(page.getByText(/목표 1.5L/)).toBeVisible()
})
