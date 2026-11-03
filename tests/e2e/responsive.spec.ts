import { expect, test, type Page } from '@playwright/test'

const PAGES = [
  { path: '/home', heading: /님,/ },
  { path: '/record', heading: '기록' },
  { path: '/record/medication', heading: '투약 기록' },
  { path: '/record/medication/new', heading: '투약 기록하기' },
  { path: '/analysis', heading: '분석' },
  { path: '/analysis/medication', heading: '참고용 잔존량' },
  { path: '/onboarding/first-dose', heading: '어떤 약을 맞으셨나요?' },
]

const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1F2FF}]/u

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow, '가로 스크롤 없어야 함').toBeLessThanOrEqual(0)
}

async function expectNoClippedButtons(page: Page) {
  // 버튼/링크 텍스트가 잘려서 말줄임(...) 되었는지 검사 (truncate 클래스 대상)
  const clipped = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('button, [role="radio"]')]
      .filter((el) => el.offsetParent !== null && el.scrollWidth > el.clientWidth + 1)
      .map((el) => el.textContent?.trim()),
  )
  expect(clipped, '잘린 버튼 텍스트').toEqual([])
}

for (const p of PAGES) {
  test(`${p.path} — 레이아웃 검사`, async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.goto(p.path)
    await expect(page.getByRole('heading', { name: p.heading }).first()).toBeVisible()
    await expectNoHorizontalScroll(page)
    await expectNoClippedButtons(page)
    const text = await page.locator('body').innerText()
    expect(text.match(EMOJI), '이모지 사용 금지').toBeNull()
    expect(errors).toEqual([])
  })
}

test('5탭 내비게이션이 작동한다', async ({ page }, info) => {
  await page.goto('/home')
  const isMobile = info.project.name === 'mobile-390'
  const nav = page.getByRole('navigation', { name: '주 메뉴' }).locator('visible=true')
  await expect(nav).toHaveCount(1)
  if (isMobile) await expect(nav).toHaveClass(/bottom-0/)
  for (const [label, url] of [
    ['기록', '/record'],
    ['분석', '/analysis'],
    ['커뮤니티', '/community'],
    ['마이', '/my'],
    ['홈', '/home'],
  ]) {
    await nav.getByRole('link', { name: label, exact: true }).click()
    await expect(page).toHaveURL(url)
  }
})

test('참고 곡선 화면은 고정 면책 문구를 항상 표시한다', async ({ page }) => {
  for (const path of ['/analysis', '/analysis/medication', '/record/medication/new']) {
    await page.goto(path)
    await expect(page.getByText('참고용 계산값이며 실제 혈중농도 또는 약효를 의미하지 않습니다.').first()).toBeVisible()
  }
})

test('출처 없는 약(에페)은 곡선을 만들지 않는다', async ({ page }) => {
  await page.goto('/analysis/medication')
  await page.getByRole('radio', { name: '에페' }).click()
  await expect(page.getByText('곡선을 만들지 않아요', { exact: true })).toBeVisible()
})

test('투약 기록: 입력 검증 → 목업 저장 → 목록 반영 → 삭제', async ({ page }) => {
  await page.goto('/record/medication/new')
  await page.getByRole('button', { name: '저장' }).click()
  await expect(page.getByRole('alert')).toContainText('용량')
  await page.getByRole('radio', { name: '7.5 mg' }).click()
  await page.getByRole('radio', { name: '허벅지' }).click()
  await page.getByRole('button', { name: '저장' }).click()
  await expect(page).toHaveURL('/record/medication')
  await expect(page.getByText('목업: 화면에만 저장됐어요')).toBeVisible()
  await page.getByRole('link', { name: /마운자로 7.5mg/ }).click()
  await page.getByRole('button', { name: '기록 삭제' }).click()
  await page.getByRole('dialog').getByRole('button', { name: '삭제' }).click()
  await expect(page).toHaveURL('/record/medication')
  await expect(page.getByRole('link', { name: /마운자로 7.5mg/ })).toHaveCount(0)
})

test('미래 날짜 투약은 저장을 막는다', async ({ page }) => {
  await page.goto('/record/medication/new')
  await page.getByRole('radio', { name: '5 mg', exact: true }).click()
  await page.getByRole('radio', { name: '팔' }).click()
  await page.getByLabel('투여 일시').fill('2099-01-01T10:00')
  await page.getByRole('button', { name: '저장' }).click()
  await expect(page.getByRole('alert')).toContainText('미래 날짜')
})

test('없는 주소는 404 화면', async ({ page }) => {
  await page.goto('/no-such-page')
  await expect(page.getByText('페이지를 찾을 수 없어요')).toBeVisible()
})

test('홈 체중 카드는 감량을 일상 물건에 비유한다 (근사 표현)', async ({ page }) => {
  await page.goto('/home')
  const card = page.getByRole('link', { name: '체중 변화 자세히 보기' })
  await expect(card).toContainText('정도 가벼워졌어요')
  await expect(card).toContainText('약 ')
  await expect(card).toContainText('총 감량 체중')
})

test('체중 비유 카드 갤러리: 증가·변화 없음은 중립 문구', async ({ page }) => {
  await page.goto('/preview/weight-cards')
  await expect(page.getByText('시작 체중과 비교한 기록이에요')).toHaveCount(2)
  await expectNoHorizontalScroll(page)
})

test('첫 투약 등록 5단계: 순서대로 진행·이전·요약·확인', async ({ page }) => {
  await page.goto('/onboarding/first-dose')
  const sheet = page.getByRole('dialog')
  await expect(sheet.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1')
  // STEP 1 → 2
  await sheet.getByRole('radio', { name: /에페/ }).click()
  await expect(sheet.getByRole('heading', { name: '용량을 선택해 주세요' })).toBeVisible()
  // 에페 허가 용량만 표시
  await expect(sheet.getByRole('radio', { name: /mg$/ })).toHaveCount(5)
  await expect(sheet.getByRole('radio', { name: '2.5mg' })).toHaveCount(0)
  // 이전 단계 → 선택 유지
  await sheet.getByRole('button', { name: '이전 단계' }).click()
  await expect(sheet.getByRole('radio', { name: /에페/ })).toHaveAttribute('aria-checked', 'true')
  await sheet.getByRole('radio', { name: /에페/ }).click()
  await sheet.getByRole('radio', { name: '6mg' }).click()
  // STEP 3: 에페는 복부만 선택 가능
  await expect(sheet.getByRole('heading', { name: '어디에 맞으셨나요?' })).toBeVisible()
  await expect(sheet.getByRole('button', { name: '다음', exact: true })).toBeDisabled()
  await expect(sheet.getByRole('radio', { name: /왼쪽 허벅지/ })).toHaveAttribute('aria-disabled', 'true')
  await sheet.getByRole('radio', { name: '배 오른쪽' }).click()
  await expect(sheet.getByText('배 오른쪽 (내 몸 기준)')).toBeVisible()
  await sheet.getByRole('button', { name: '다음', exact: true }).click()
  // STEP 4: 미래 날짜 선택 불가, 시간 모름 허용
  await expect(sheet.getByRole('button', { name: /선택할 수 없음/ }).first()).toBeDisabled()
  await sheet.getByRole('button', { name: '어제', exact: true }).click()
  await sheet.getByRole('checkbox', { name: /시간이 기억나지 않아요/ }).check()
  await sheet.getByRole('button', { name: '다음', exact: true }).click()
  // STEP 5 요약
  await expect(sheet.getByText('에페', { exact: true })).toBeVisible()
  await expect(sheet.getByText('6mg')).toBeVisible()
  await expect(sheet.getByText('시간 모름')).toBeVisible()
  await sheet.getByRole('button', { name: '확인', exact: true }).click()
  await expect(sheet.getByText('실제로 저장되지 않았어요')).toBeVisible()
})

test('첫 투약 등록: 오늘 미래 시간은 다음으로 넘어갈 수 없다', async ({ page }) => {
  await page.goto('/onboarding/first-dose')
  const sheet = page.getByRole('dialog')
  await sheet.getByRole('radio', { name: /마운자로/ }).click()
  await sheet.getByRole('radio', { name: '5mg', exact: true }).click()
  await sheet.getByRole('radio', { name: '배 왼쪽' }).click()
  await sheet.getByRole('button', { name: '다음', exact: true }).click()
  await sheet.getByRole('button', { name: '오늘', exact: true }).click()
  await sheet.getByLabel('시간', { exact: true }).fill('23:59')
  const now = new Date()
  if (now.getHours() === 23 && now.getMinutes() >= 58) test.skip()
  await expect(sheet.getByRole('alert')).toContainText('아직 지나지 않은 시간')
  await expect(sheet.getByRole('button', { name: '다음', exact: true })).toBeDisabled()
})

test('첫 투약 등록: 입력 중 닫으면 확인 후 이어서 할 수 있다 (Esc)', async ({ page }) => {
  await page.goto('/onboarding/first-dose')
  await page.getByRole('dialog').getByRole('radio', { name: /위고비/ }).click()
  await page.keyboard.press('Escape')
  await expect(page.getByText('기록을 잠시 멈출까요?')).toBeVisible()
  await page.getByRole('dialog', { name: '기록을 잠시 멈출까요?' }).getByRole('button', { name: '닫기', exact: true }).first().click()
  await page.getByRole('button', { name: /이어서 기록하기 \(2\/5\)/ }).click()
  await expect(page.getByRole('dialog').getByRole('heading', { name: '용량을 선택해 주세요' })).toBeVisible()
})
