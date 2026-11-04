import { expect, test, type Page } from '@playwright/test'

/** Phase 5 — 분석 화면(타임라인·바디 변화·식단 영양·상담 준비). 목업 모드(예시 사용자)에서 검증. 눈바디는 eyebody.spec.ts */

/** 한 화면 크기(모바일)에서만 */
const onlyMobile = () => test.skip(test.info().project.name !== 'mobile-390', '한 화면 크기에서만')

/** 분석 첫 진입 안내(바텀시트)를 닫는다 */
async function closeNotice(page: Page) {
  const ok = page.getByRole('button', { name: '확인했어요' })
  if (await ok.isVisible().catch(() => false)) await ok.click()
}
/** 목업 상태는 새로고침하면 초기화되므로 앱 안에서 이동 */
async function softGo(page: Page, path: string) {
  await page.evaluate((p) => {
    history.pushState({}, '', p)
    dispatchEvent(new PopStateEvent('popstate'))
  }, path)
}

test('통합 타임라인·바디 변화·식단 영양·상담 준비가 기록으로 그려진다', async ({ page }) => {
  onlyMobile()
  await page.goto('/analysis/timeline')
  await expect(page.getByRole('button', { name: '확인했어요' })).toBeVisible()
  await closeNotice(page)
  await expect(page.getByRole('heading', { name: '통합 타임라인' })).toBeVisible()
  const days = page.getByRole('list', { name: '날짜별 기록' }).locator('> li')
  expect(await days.count()).toBeGreaterThan(3)
  await expect(page.getByText('증상과 약의 관계를 판단하지 않아요', { exact: false })).toBeVisible()

  await softGo(page, '/analysis/body')
  await expect(page.getByRole('img', { name: '체중 변화 그래프' })).toBeVisible()

  await softGo(page, '/analysis/nutrition')
  await expect(page.getByText('일평균 섭취 칼로리')).toBeVisible()
  await expect(page.getByRole('img', { name: '날짜별 칼로리 막대 그래프' })).toBeVisible()

  await softGo(page, '/analysis/consult')
  const summary = page.getByLabel('상담 준비 요약')
  await expect(summary).toContainText(/투약 \d+회/)
  await expect(summary).toContainText('체중')
  await expect(summary).toContainText('진단이나 용량 판단에 쓰는 자료가 아니며')
})

test('새 사용자는 분석 화면에 가짜 그래프 대신 빈 상태', async ({ page }) => {
  onlyMobile()
  await page.goto('/onboarding')
  await expect(page.getByText('사용할 수 있는 닉네임이에요.')).toBeVisible()
  await page.getByRole('button', { name: '이 닉네임으로 계속하기' }).click()
  await page.getByRole('radio', { name: '여성' }).click()
  await page.getByRole('button', { name: '나중에 입력' }).click()
  await expect(page).toHaveURL('/onboarding/goal')
  await page.getByRole('button', { name: '다음' }).click()
  await page.getByRole('radio', { name: /나중에 기록할게요/ }).click()
  await page.getByRole('button', { name: '슬림로그 시작하기' }).click()
  // 가입 직후 한 번: 영양 목표 제안 → 건너뛰기
  await expect(page).toHaveURL('/onboarding/nutrition-goal')
  await page.getByRole('button', { name: '지금은 건너뛰기' }).click()
  await softGo(page, '/analysis/nutrition')
  await closeNotice(page)
  await expect(page.getByText('이 기간에 식단 기록이 없어요')).toBeVisible()
})
