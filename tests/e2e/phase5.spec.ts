import { expect, test, type Page } from '@playwright/test'

/** Phase 5 — 분석 화면(타임라인·바디 변화·식단 영양·상담 준비)과 눈바디 금고. 목업 모드(예시 사용자)에서 검증 */

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
  await softGo(page, '/analysis/nutrition')
  await closeNotice(page)
  await expect(page.getByText('이 기간에 식단 기록이 없어요')).toBeVisible()
})

async function jpeg(page: Page, color: string) {
  const b64 = await page.evaluate((c) => {
    const cv = document.createElement('canvas')
    cv.width = 600
    cv.height = 800
    const g = cv.getContext('2d')!
    g.fillStyle = c
    g.fillRect(0, 0, 600, 800)
    return cv.toDataURL('image/jpeg', 0.9).split(',')[1]
  }, color)
  return { name: 'body.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(b64, 'base64') }
}

test('눈바디: 비밀번호 → 사진 2장 저장(암호화) → 잠금·해제 → 비교 → 삭제', async ({ page }) => {
  onlyMobile()
  await page.goto('/record/eyebody')
  await expect(page.getByText('눈바디 비밀번호 만들기')).toBeVisible()
  await page.getByLabel('비밀번호 (6자 이상)').fill('eyebody1')
  await page.getByLabel('비밀번호 확인').fill('eyebody1')
  await page.getByRole('button', { name: '만들기' }).click()

  await page.getByLabel('찍은 날짜').fill('2026-10-01')
  await page.getByLabel('눈바디 사진 선택').setInputFiles(await jpeg(page, '#d9a066'))
  await expect(page.getByText('눈바디 사진을 저장했어요')).toBeVisible()
  await page.getByLabel('찍은 날짜').fill('2026-11-01')
  await page.getByLabel('눈바디 사진 선택').setInputFiles(await jpeg(page, '#6699cc'))
  await expect(page.getByRole('list', { name: '눈바디 사진 목록' }).locator('> li')).toHaveCount(2)
  await expect(page.getByRole('img', { name: /눈바디$/ }).first()).toBeVisible()

  // 저장된 바이트는 JPEG 가 아니다 (암호화됨) · 서버 요청 없음
  const raw = await page.evaluate(
    () =>
      new Promise<number[]>((resolve) => {
        const req = indexedDB.open('slimlog-eyebody')
        req.onsuccess = () => {
          const g = req.result.transaction('photos').objectStore('photos').getAll()
          g.onsuccess = () => resolve(Array.from(new Uint8Array(g.result[0].data).slice(0, 2)))
        }
      }),
  )
  expect(raw).not.toEqual([0xff, 0xd8])

  // 잠그기 → 틀린 비밀번호 → 맞는 비밀번호
  await page.getByRole('button', { name: '잠그기' }).click()
  await page.getByLabel('비밀번호 (6자 이상)').fill('wrongpw')
  await page.getByRole('button', { name: '잠금 해제' }).click()
  await expect(page.getByRole('alert')).toContainText('비밀번호가 맞지 않아요')
  await page.getByLabel('비밀번호 (6자 이상)').fill('eyebody1')
  await page.getByRole('button', { name: '잠금 해제' }).click()
  await expect(page.getByRole('list', { name: '눈바디 사진 목록' }).locator('> li')).toHaveCount(2)

  // 비교
  await page.getByRole('link', { name: '처음과 최근 비교하기' }).click()
  await expect(page.getByLabel('왼쪽 사진 날짜')).toBeVisible()
  await expect(page.getByRole('img', { name: /눈바디$/ })).toHaveCount(2)

  // 삭제
  await page.goto('/record/eyebody')
  await page.getByLabel('비밀번호 (6자 이상)').fill('eyebody1')
  await page.getByRole('button', { name: '잠금 해제' }).click()
  await page.getByRole('button', { name: /사진 삭제/ }).first().click()
  await page.getByRole('dialog').getByRole('button', { name: '삭제', exact: true }).click()
  await expect(page.getByRole('list', { name: '눈바디 사진 목록' }).locator('> li')).toHaveCount(1)
})
