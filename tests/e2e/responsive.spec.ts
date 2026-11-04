import { expect, test, type Page } from '@playwright/test'

const PAGES = [
  { path: '/home', heading: /님,/ },
  { path: '/record', heading: '기록' },
  { path: '/record/medication', heading: '투약 기록' },
  { path: '/record/medication/new', heading: '투약 기록하기' },
  { path: '/analysis', heading: '분석' },
  { path: '/analysis/medication', heading: '참고용 잔존량' },
  { path: '/onboarding/first-dose', heading: '어떤 약을 맞으셨나요?' },
  { path: '/preview/brand', heading: '로고 시안' },
  { path: '/community', heading: '커뮤니티' },
  { path: '/community/p1', heading: '6주차, 단백질 챙기려고 계란을 늘렸어요' },
  { path: '/community/write', heading: '글쓰기' },
  { path: '/admin/moderation', heading: '관리자 검토' },
  { path: '/my', heading: '마이페이지' },
  { path: '/my/consent', heading: '개인정보 · 보안' },
  { path: '/my/settings', heading: '설정' },
  { path: '/my/settings/notifications', heading: '알림 설정' },
  { path: '/my/settings/app', heading: '화면 및 앱 환경' },
  { path: '/my/body', heading: '신체 정보 · 목표' },
  { path: '/my/liked', heading: '공감한 글' },
  { path: '/my/data', heading: '내 데이터 관리' },
  { path: '/my/support', heading: '고객지원 · 서비스 정보' },
  { path: '/my/terms', heading: '이용약관 · 개인정보 처리방침' },
  { path: '/onboarding/nickname', heading: /반가워요/ },
  { path: '/my/eyebody-data', heading: '눈바디 로컬 데이터' },
  { path: '/my/account', heading: '연결된 로그인 계정' },
  { path: '/my/profile', heading: '프로필' },
  { path: '/login', heading: 'SlimLog 로그인' },
  { path: '/signup', heading: '이메일로 가입' },
  { path: '/consent', heading: '약관 동의' },
  { path: '/record/meal', heading: 'AI 식단' },
  { path: '/record/meal/new', heading: '오늘 무엇을 드셨나요?' },
  { path: '/record/meal/search', heading: '음식 직접 추가' },
  { path: '/record/meal/food/rice', heading: '쌀밥' },
  { path: '/record/meal/custom', heading: '직접 음식 등록' },
  { path: '/record/meal/review', heading: '오늘의 식단' },
]

const NOTICE_KEY = 'slimlog:notice:analysis-pk'

// 분석 유의사항 테스트가 아니면 '다시 보지 않기' 상태로 시작 (다른 검사를 가리지 않게)
test.beforeEach(async ({ page }, info) => {
  if (info.title.includes('유의사항')) return
  await page.addInitScript((k) => localStorage.setItem(k, JSON.stringify({ version: 1, dismissed: true })), NOTICE_KEY)
})

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
  await expect(page.getByText('투약 기록을 저장했어요')).toBeVisible()
  await expect(page.getByText('목업 · 새로고침하면 사라지며 서버에 저장되지 않아요.')).toBeVisible()
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
  await expect(sheet.getByRole('heading', { name: '투여한 용량을 선택해 주세요' })).toBeVisible()
  // 에페 허가 용량(2~10mg, 5단계)만 선택 가능
  const slider = sheet.getByRole('slider')
  await expect(slider).toHaveAttribute('aria-valuemax', '4')
  await expect(slider).toHaveAttribute('aria-valuetext', '2mg')
  // 이전 단계 → 선택 유지
  await sheet.getByRole('button', { name: '이전 단계' }).click()
  await expect(sheet.getByRole('radio', { name: /에페/ })).toHaveAttribute('aria-checked', 'true')
  await sheet.getByRole('radio', { name: /에페/ }).click()
  // 다음 버튼·키보드·스와이프로 값 변경
  await sheet.getByRole('button', { name: '다음 용량' }).click()
  await sheet.getByRole('slider').press('ArrowRight')
  await expect(sheet.getByRole('slider')).toHaveAttribute('aria-valuetext', '6mg')
  await sheet.getByRole('button', { name: '다음', exact: true }).click()
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
  await sheet.getByRole('slider').press('ArrowRight')
  await sheet.getByRole('button', { name: '다음', exact: true }).click()
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
  await expect(page.getByRole('dialog').getByRole('heading', { name: '투여한 용량을 선택해 주세요' })).toBeVisible()
})

test('용량 선택기: 좌우 스와이프로 값이 바뀐다', async ({ page }) => {
  await page.goto('/onboarding/first-dose')
  const sheet = page.getByRole('dialog')
  await sheet.getByRole('radio', { name: /마운자로/ }).click()
  const slider = sheet.getByRole('slider')
  await expect(slider).toHaveAttribute('aria-valuetext', '2.5mg')
  const box = (await sheet.getByText('1 / 6').boundingBox())!
  await page.mouse.move(box.x + box.width / 2 + 60, box.y)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 - 60, box.y, { steps: 5 })
  await page.mouse.up()
  await expect(slider).toHaveAttribute('aria-valuetext', '5mg')
  await expect(sheet.getByText('2 / 6')).toBeVisible()
})

test('참고 곡선: 기간 전환·툴팁·약별 기록만 표시', async ({ page }) => {
  await page.goto('/analysis/medication')
  await expect(page.getByText('현재 참고 수준')).toBeVisible()
  for (const label of ['2주', '3개월', '1개월']) {
    await page.getByRole('radio', { name: label, exact: true }).click()
    await expect(page.getByRole('radio', { name: label, exact: true })).toHaveAttribute('aria-checked', 'true')
  }
  const chart = page.getByRole('img', { name: /참고용 잔존량 상대값 곡선/ })
  // 기본: 오늘 값 말풍선, 누르면 그 시점 값으로 바뀐다
  const bubble = page.locator('.residual-bubble-value')
  const before = await bubble.textContent()
  const box = (await chart.boundingBox())!
  await page.mouse.click(box.x + box.width * 0.35, box.y + box.height / 2)
  await expect(bubble).not.toHaveText(before!)
  // 위고비는 기록이 없으므로 빈 상태 (마운자로 기록을 섞지 않음)
  await page.getByRole('radio', { name: '위고비' }).click()
  await expect(page.getByText('이 기간에 투약 기록이 없어요')).toBeVisible()
  // mg 단위는 곡선 값에 쓰지 않는다
  await expect(page.getByText(/잔존량 \d+(\.\d+)?\s?mg/)).toHaveCount(0)
})

test('참고 곡선 ⓘ: 계산 방식·파라미터·출처 안내', async ({ page }) => {
  await page.goto('/analysis/medication')
  await page.getByRole('button', { name: '참고용 잔존량 계산 안내 보기' }).click()
  const sheet = page.getByRole('dialog', { name: '참고용 잔존량 계산 안내' })
  await expect(sheet.getByText('mg으로 표시하지 않는 이유')).toBeVisible()
  await expect(sheet.getByText('약 5일')).toBeVisible()
  await expect(sheet.getByText('허가자료에 없음')).toBeVisible()
})

test.describe('분석 유의사항', () => {
  test('유의사항: 최초 진입 시 자동 표시, 체크 없이 닫으면 재진입 때 다시 표시', async ({ page }) => {
    await page.goto('/analysis')
    const notice = page.getByRole('dialog', { name: '분석 결과를 확인하기 전에' })
    await expect(notice).toBeVisible()
    await notice.getByRole('button', { name: '확인했어요' }).click()
    await expect(notice).toHaveCount(0)
    // 분석 하위 화면 이동은 같은 방문 → 다시 안 뜸
    await page.getByRole('link', { name: /참고용 잔존량/ }).first().click()
    await expect(page).toHaveURL('/analysis/medication')
    await expect(notice).toHaveCount(0)
    // 다른 탭 갔다가 재진입 → 다시 표시
    await page.goto('/home')
    await page.getByRole('navigation', { name: '주 메뉴' }).locator('visible=true').getByRole('link', { name: '분석', exact: true }).click()
    await expect(notice).toBeVisible()
  })

  test('유의사항: 다시 보지 않기 → 다음 진입부터 표시 안 함, 간단 문구는 유지', async ({ page }) => {
    await page.goto('/analysis')
    const notice = page.getByRole('dialog', { name: '분석 결과를 확인하기 전에' })
    await notice.getByRole('checkbox', { name: '다시 보지 않기' }).check()
    await notice.getByRole('button', { name: '확인했어요' }).click()
    await page.reload()
    await expect(page.getByRole('heading', { name: '분석', level: 1 })).toBeVisible()
    await expect(notice).toHaveCount(0)
    await expect(page.getByText('참고용 계산값이며 실제 혈중농도 또는 약효를 의미하지 않습니다.').first()).toBeVisible()
  })

  test('유의사항: ⓘ로 수동 재열기, 닫으면 포커스 복원', async ({ page }) => {
    await page.addInitScript((k) => localStorage.setItem(k, JSON.stringify({ version: 1, dismissed: true })), NOTICE_KEY)
    await page.goto('/analysis')
    const btn = page.getByRole('button', { name: '분석 유의사항 보기' })
    await btn.click()
    const notice = page.getByRole('dialog', { name: '분석 결과를 확인하기 전에' })
    await expect(notice).toBeVisible()
    await expect(notice.getByRole('checkbox', { name: '다시 보지 않기' })).toBeChecked()
    await page.keyboard.press('Escape')
    await expect(notice).toHaveCount(0)
    await expect(btn).toBeFocused()
  })

  test('유의사항: noticeVersion이 바뀌면 다시 표시', async ({ page }) => {
    await page.addInitScript((k) => localStorage.setItem(k, JSON.stringify({ version: 0, dismissed: true })), NOTICE_KEY)
    await page.goto('/analysis')
    await expect(page.getByRole('dialog', { name: '분석 결과를 확인하기 전에' })).toBeVisible()
  })
})

test('홈: 체중 변화가 최상단 메인 카드, 로고 표시', async ({ page }) => {
  await page.goto('/home')
  const hero = page.getByRole('link', { name: '체중 변화 자세히 보기' })
  const today = page.getByRole('heading', { name: '오늘의 기록' })
  const heroBox = (await hero.boundingBox())!
  const todayBox = (await today.boundingBox())!
  expect(heroBox.y).toBeLessThan(todayBox.y)
  await expect(page.getByRole('img', { name: 'SlimLog' }).locator('visible=true').first()).toBeVisible()
})

test('브랜드: 파비콘·PWA 매니페스트·아이콘 제공', async ({ request }) => {
  const manifest = await (await request.get('/manifest.webmanifest')).json()
  expect(manifest.short_name).toBe('SlimLog')
  for (const icon of manifest.icons) expect((await request.get(icon.src)).ok()).toBeTruthy()
  expect((await request.get('/favicon.svg')).ok()).toBeTruthy()
})

test.describe('커뮤니티', () => {
  test('목록: REVIEW 글은 전체 목록에 없고 내 글에서만 검토 중으로 보인다', async ({ page }) => {
    await page.goto('/community')
    await expect(page.getByText('용량 올리는 시기 경험 공유')).toHaveCount(0)
    await page.getByRole('tab', { name: '내 글' }).click()
    await expect(page.getByText('용량 올리는 시기 경험 공유')).toBeVisible()
    await expect(page.getByText('검토 중 · 나만 보임')).toBeVisible()
  })

  test('글쓰기: 띄어쓴 "양 도"도 BLOCKED, 게시 버튼 비활성', async ({ page }) => {
    await page.goto('/community/write')
    await page.getByRole('radio', { name: '자유' }).click()
    await page.getByLabel('제목').fill('남은 펜')
    await page.getByLabel('내용').fill('필요하신 분 양 도해요. 쪽지 주세요')
    await page.getByRole('button', { name: '검사해 보기' }).click()
    await expect(page.getByText('게시할 수 없는 내용이 있어요 (BLOCKED)')).toBeVisible()
    await expect(page.locator('mark').first()).toContainText('양 도')
    await expect(page.getByRole('button', { name: '게시하기' })).toBeDisabled()
  })

  test('글쓰기: 용량 권유는 REVIEW → 게시 후 검토 중 안내', async ({ page }) => {
    await page.goto('/community/write')
    await page.getByRole('radio', { name: '질문' }).click()
    await page.getByLabel('제목').fill('증량 질문')
    await page.getByLabel('내용').fill('다들 몇 mg부터 올리세요? 궁금해요')
    await page.getByRole('button', { name: '게시하기' }).click()
    await expect(page.getByText('관리자 검토 중이에요')).toBeVisible()
  })

  test('상세: 좋아요·댓글·신고', async ({ page }) => {
    await page.goto('/community/p1')
    const like = page.getByRole('button', { name: /좋아요 \d+/ })
    await expect(like).toHaveText(/좋아요 24/)
    await like.click()
    await expect(like).toHaveText(/좋아요 25/)
    await page.getByLabel('댓글', { exact: true }).fill('좋은 정보 감사해요')
    await page.getByRole('button', { name: '등록' }).click()
    await expect(page.getByText('좋은 정보 감사해요')).toBeVisible()
    await page.getByRole('button', { name: '신고' }).click()
    const dlg = page.getByRole('dialog', { name: '신고하기' })
    await expect(dlg.getByRole('button', { name: '신고 접수' })).toBeDisabled()
    await dlg.getByRole('radio', { name: '광고·홍보' }).click()
    await dlg.getByRole('button', { name: '신고 접수' }).click()
    await expect(page.getByText('목업: 신고가 접수됐어요')).toBeVisible()
  })

  test('내 글: 수정(재검사)·삭제', async ({ page }) => {
    await page.goto('/community/p5')
    await page.getByRole('button', { name: '글 메뉴' }).click()
    await page.getByRole('link', { name: '수정' }).click()
    await expect(page.getByRole('heading', { name: '글 수정' })).toBeVisible()
    await page.getByLabel('내용').fill('진료 때 물어볼 내용을 정리했어요.')
    await page.getByRole('button', { name: '다시 검사 후 저장' }).click()
    await expect(page.getByText('진료 때 물어볼 내용을 정리했어요.')).toBeVisible()
    await page.getByRole('button', { name: '글 메뉴' }).click()
    await page.getByRole('button', { name: '삭제' }).click()
    await page.getByRole('dialog').getByRole('button', { name: '삭제', exact: true }).click()
    await expect(page).toHaveURL('/community')
  })

  test('관리자: 사유 없이는 조치 저장 불가, 저장 시 감사 로그 추가', async ({ page }) => {
    await page.goto('/admin/moderation')
    await page.getByRole('radio', { name: '반려' }).click()
    const save = page.getByRole('button', { name: '조치 저장' })
    await expect(save).toBeDisabled()
    await page.getByLabel('사유 (필수)').fill('용량 권유 문구 포함')
    await save.click()
    await expect(page.getByText('관리자1 · 용량 권유 문구 포함')).toBeVisible()
    await expect(page.getByText('검토 대기 2건')).toBeVisible()
  })
})

test.describe('로그인·가입', () => {
  test('소셜 로그인(목업) → 동의: 필수 미동의면 시작 불가 → 첫 투약', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByRole('button', { name: '네이버 로그인' })).toHaveCount(0)
    await page.getByRole('button', { name: '카카오 로그인' }).click()
    await expect(page).toHaveURL('/consent')
    const start = page.getByRole('button', { name: '동의하고 시작하기' })
    await expect(start).toBeDisabled()
    await page.getByRole('checkbox', { name: '필수 서비스 이용약관' }).click()
    await page.getByRole('checkbox', { name: '필수 개인정보 수집·이용' }).click()
    await expect(start).toBeDisabled()
    await page.getByRole('checkbox', { name: '필수 민감정보(건강정보) 처리' }).click()
    await expect(start).toBeEnabled()
    await start.click()
    await expect(page).toHaveURL('/onboarding/nickname')
  })

  test('이메일 가입: 형식 검증', async ({ page }) => {
    await page.goto('/signup')
    await page.getByLabel('이메일').fill('abc')
    await page.getByLabel('비밀번호', { exact: true }).fill('1234')
    await page.getByRole('button', { name: '다음' }).click()
    await expect(page.getByText('이메일 형식을 확인해 주세요.')).toBeVisible()
    await expect(page.getByText('영문과 숫자를 섞어 8자 이상 입력해 주세요.')).toBeVisible()
    await expect(page).toHaveURL('/signup')
  })
})

test.describe('마이', () => {
  test('민감정보 동의 철회는 경고 후 처리', async ({ page }) => {
    await page.goto('/my/consent')
    await page.getByRole('switch', { name: /민감정보/ }).click()
    await expect(page.getByText('철회하면 저장된 투약·증상·체성분 기록이 삭제되고')).toBeVisible()
    await page.getByRole('button', { name: '취소' }).click()
    await expect(page.getByRole('switch', { name: /민감정보/ })).toHaveAttribute('aria-checked', 'true')
  })

  test('로그아웃 → 로그인 화면 (설정 하단)', async ({ page }) => {
    await page.goto('/my/settings')
    await page.getByRole('button', { name: '로그아웃' }).click()
    await page.getByRole('dialog').getByRole('button', { name: '로그아웃' }).click()
    await expect(page).toHaveURL('/login')
  })
})

test.describe('마이페이지 · 설정', () => {
  test('톱니바퀴 → 설정 → 뒤로 가기는 마이페이지', async ({ page }) => {
    await page.goto('/my')
    await expect(page.getByText('나의 목표 체중')).toBeVisible()
    await expect(page.getByRole('button', { name: '로그아웃' })).toHaveCount(0)
    await page.getByRole('link', { name: '설정', exact: true }).click()
    await expect(page).toHaveURL('/my/settings')
    for (const t of ['앱 설정', '개인정보 및 계정', '서비스']) await expect(page.getByText(t, { exact: true })).toBeVisible()
    await page.goBack()
    await expect(page).toHaveURL('/my')
  })

  test('회원 탈퇴는 연결된 로그인 계정 하위', async ({ page }) => {
    await page.goto('/my/settings')
    await page.getByRole('link', { name: /연결된 로그인 계정/ }).click()
    await expect(page.getByRole('button', { name: '회원 탈퇴' })).toBeVisible()
  })

  test('내가 쓴 글 → 커뮤니티 내 글 탭', async ({ page }) => {
    await page.goto('/my')
    await page.getByRole('link', { name: /내가 쓴 글/ }).click()
    await expect(page.getByRole('tab', { name: '내 글' })).toHaveAttribute('aria-selected', 'true')
  })
})

test.describe('온보딩', () => {
  const next = (page: import('@playwright/test').Page) => page.getByRole('button', { name: '이 닉네임으로 계속하기' })

  test('자동 닉네임 → 신체정보(목표 변화량) → 나중에 기록 → 첫 홈(허위 감량 없음)', async ({ page }) => {
    await page.goto('/onboarding')
    await expect(page).toHaveURL('/onboarding/nickname')
    await expect(page.getByLabel('나의 닉네임')).not.toHaveValue('')
    await expect(page.getByText('사용할 수 있는 닉네임이에요.')).toBeVisible()
    await next(page).click()
    await expect(page).toHaveURL('/onboarding/body')
    await page.getByLabel('현재 체중').fill('500')
    await expect(page.getByText('20~300kg 사이로 입력해 주세요.').first()).toBeVisible()
    await expect(page.getByLabel('목표 변화량')).toHaveCount(0)
    await page.getByLabel('현재 체중').fill('80')
    await page.getByLabel('목표 체중').fill('72')
    await expect(page.getByLabel('목표 변화량')).toContainText('−8.0kg')
    await page.getByLabel('목표 체중').fill('82.5')
    await expect(page.getByLabel('목표 변화량')).toContainText('+2.5kg')
    await page.getByLabel('목표 체중').fill('72')
    await page.getByRole('button', { name: '다음' }).click()
    await page.getByRole('radio', { name: /나중에 기록할게요/ }).click()
    await page.getByRole('button', { name: '슬림로그 시작하기' }).click()
    await expect(page).toHaveURL('/home')
    await expect(page.getByText('첫 기록을 시작했어요')).toBeVisible()
    await expect(page.getByText('80.0')).toBeVisible()
    await expect(page.getByText(/가벼워졌어요/)).toHaveCount(0)
    await expect(page.getByText('아직 투약 기록이 없어요.', { exact: false })).toBeVisible()
  })

  test('중복 닉네임은 계속할 수 없다', async ({ page }) => {
    await page.goto('/onboarding/nickname')
    await page.getByLabel('나의 닉네임').fill('느긋한판다')
    await expect(page.getByText('이미 사용 중인 닉네임이에요.', { exact: false })).toBeVisible()
    await expect(next(page)).toBeDisabled()
    await page.getByLabel('나의 닉네임').fill('a b')
    await expect(page.getByText('한글, 영문, 숫자만', { exact: false })).toBeVisible()
  })

  test('동시 가입 충돌: 확인 후 저장 순간 중복 → 추천 닉네임으로 재시도', async ({ page }) => {
    await page.goto('/onboarding/nickname')
    await page.getByLabel('나의 닉네임').fill('졸린복숭아')
    await expect(page.getByText('사용할 수 있는 닉네임이에요.')).toBeVisible()
    await next(page).click()
    await expect(page.getByText('방금 다른 분이 먼저 사용했어요.', { exact: false })).toBeVisible()
    const chips = page.getByLabel('추천 닉네임').getByRole('button')
    await expect(chips).toHaveCount(3)
    await chips.first().click()
    await expect(page.getByText('사용할 수 있는 닉네임이에요.')).toBeVisible()
    await next(page).click()
    await expect(page).toHaveURL('/onboarding/body')
  })

  test('네트워크 오류 상태와 다시 확인', async ({ page }) => {
    await page.goto('/onboarding/nickname')
    await page.getByLabel('나의 닉네임').fill('네트워크오류')
    await expect(page.getByText('확인하지 못했어요.', { exact: false })).toBeVisible()
    await expect(page.getByRole('button', { name: '다시 확인' })).toBeVisible()
  })

  test('중단 후 복귀: 새로고침해도 진행 단계·입력값 유지, 뒤로 가기는 이전 단계', async ({ page }) => {
    await page.goto('/onboarding/nickname')
    await expect(page.getByText('사용할 수 있는 닉네임이에요.')).toBeVisible()
    const name = await page.getByLabel('나의 닉네임').inputValue()
    await next(page).click()
    await page.getByLabel('현재 체중').fill('80')
    await page.reload()
    await expect(page.getByLabel('현재 체중')).toHaveValue('80')
    await page.goBack()
    await expect(page.getByLabel('나의 닉네임')).toHaveValue(name)
    await page.goto('/onboarding')
    await expect(page).toHaveURL('/onboarding/body')
  })

  test('지금 기록하기 → 기존 5단계 → 저장 후 홈에 최근 투약 표시 / 취소해도 입력 유지', async ({ page }) => {
    await page.goto('/onboarding/nickname')
    await expect(page.getByText('사용할 수 있는 닉네임이에요.')).toBeVisible()
    await next(page).click()
    await page.getByRole('button', { name: '나중에 입력' }).click()
    await page.getByRole('radio', { name: /지금 투약 내역 기록하기/ }).click()
    await page.getByRole('button', { name: '투약 기록 시작하기' }).click()
    const sheet = page.getByRole('dialog')
    // 취소 → 3단계 유지
    await sheet.getByRole('radio', { name: /마운자로/ }).click()
    await page.keyboard.press('Escape')
    await page.getByRole('dialog', { name: '기록을 잠시 멈출까요?' }).getByRole('button', { name: '닫기', exact: true }).first().click()
    await expect(page).toHaveURL('/onboarding/medication')
    // 다시 진행
    await page.getByRole('button', { name: '투약 기록 시작하기' }).click()
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
    await expect(page.getByText('마운자로 2.5mg').first()).toBeVisible()
    await expect(page.getByText('시작 체중을 기록해 볼까요?')).toBeVisible()
  })

  test('온보딩을 마친 사용자는 로그인 후 바로 홈', async ({ page }) => {
    await page.addInitScript(() =>
      localStorage.setItem('slimlog:onboarding:v1', JSON.stringify({ state: { step: 'medication', nickname: '우는자몽', nicknameSaved: true, heightCm: '', weightKg: '80', goalKg: '72', bodySkipped: false, baselineSavedAt: null, doseChoice: 'later', completedAt: '2026-11-03T00:00:00.000Z' }, version: 1 })),
    )
    await page.goto('/login')
    await page.getByRole('button', { name: '카카오 로그인' }).click()
    await expect(page).toHaveURL('/home')
    await page.goto('/onboarding')
    await expect(page).toHaveURL('/home')
  })
})

test.describe('케어', () => {
  test('홈 카드: 기존 수분 기록을 mL로 이어서 표시, 시트에서 물 추가', async ({ page }) => {
    await page.goto('/home')
    const card = page.getByRole('button', { name: /케어/ })
    await expect(card).toContainText('물 1.5L · 복용 1건')
    await card.click()
    const sheet = page.getByRole('dialog', { name: '케어' })
    await expect(sheet.getByText('기존 컵 기록 환산')).toBeVisible()
    await sheet.getByRole('button', { name: '+250mL' }).click()
    await expect(sheet.getByText('1,750')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(card).toContainText('물 1.8L')
  })

  test('영양제 등록(자동완성)·섭취 완료·알림 묻기·시계, 복용약 탭 안내', async ({ page }) => {
    await page.goto('/home')
    await page.getByRole('button', { name: /케어/ }).click()
    const sheet = page.getByRole('dialog', { name: '케어' })
    await sheet.getByRole('tab', { name: '영양제' }).click()
    await sheet.getByRole('button', { name: '등록' }).click()
    await sheet.getByLabel('영양제 이름').fill('유')
    await expect(sheet.getByRole('listbox', { name: '영양제 추천' })).toBeVisible()
    expect(await sheet.getByRole('listbox', { name: '영양제 추천' }).getByRole('option').count()).toBeLessThanOrEqual(5)
    await sheet.getByLabel('영양제 이름').fill('유산균')
    await sheet.getByRole('button', { name: '등록하기' }).click()
    const row = sheet.locator('li', { hasText: '유산균' })
    await expect(row).toContainText('아직 기록하지 않았어요')
    await sheet.getByRole('button', { name: '유산균 섭취 완료' }).click()
    // 처음 섭취 완료 → 매일 알림 받을지 물어봄 → 확인 → 원판 시계
    await page.getByRole('dialog', { name: '매일 알림을 보내드릴게요' }).getByRole('button', { name: '확인' }).click()
    const clock = page.getByRole('slider', { name: '알림 시각' })
    await clock.focus()
    await page.getByRole('radio', { name: '오전' }).click()
    await clock.press('ArrowRight')
    await expect(clock).toHaveAttribute('aria-valuetext', /오전 \d+시/)
    await page.getByRole('dialog', { name: '알림 시간' }).getByRole('button', { name: '저장' }).click()
    await expect(row).toContainText('오늘 섭취 완료')
    await expect(row.getByRole('button', { name: /알림 오전 \d+시 바꾸기/ })).toBeVisible()
    // 다시 누르면 취소, 건너뛰기
    await sheet.getByRole('button', { name: '유산균 섭취 취소' }).click()
    await row.getByRole('button', { name: '건너뛰기' }).click()
    await expect(row).toContainText('오늘 건너뛰었어요')
    await sheet.getByRole('tab', { name: '복용약' }).click()
    await expect(sheet.getByText('주사는 홈의 ‘투약’에서 기록해요', { exact: false })).toBeVisible()
    await expect(sheet.getByText('등록한 복용약이 없어요', { exact: false })).toBeVisible()
  })
})

test.describe('분석 3탭', () => {
  test('탭 전환 시 선택된 콘텐츠만 표시, 주소에 탭 유지', async ({ page }) => {
    await page.goto('/analysis')
    await expect(page.getByRole('tab', { name: '체내 용량' })).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByText('현재 참고 수준')).toBeVisible()
    await page.getByRole('tab', { name: '체중 변화' }).click()
    await expect(page).toHaveURL('/analysis?tab=weight')
    await expect(page.getByText('현재 참고 수준')).toHaveCount(0)
    await expect(page.getByRole('radiogroup', { name: '기간' })).toBeVisible()
    await expect(page.getByRole('img', { name: '체중 변화 그래프' })).toBeVisible()
    await page.reload()
    await expect(page.getByRole('tab', { name: '체중 변화' })).toHaveAttribute('aria-selected', 'true')
  })

  test('인바디: 여러 회 → 최근 2회 비교·추이, 1회 → 단일 결과, 없음 → 등록 안내(결과지 등록 화면으로)', async ({ page }) => {
    await page.goto('/analysis?tab=inbody')
    await expect(page.getByText('예시 데이터 · 실제 기록 아님')).toBeVisible()
    await expect(page.getByRole('heading', { name: '최근 2회 비교' })).toBeVisible()
    await expect(page.getByRole('img', { name: '골격근량·체지방량 추이 그래프' })).toBeVisible()
    await page.getByRole('radio', { name: '1회' }).click()
    await expect(page.getByRole('heading', { name: '측정 결과' })).toBeVisible()
    await expect(page.getByRole('img', { name: '골격근량·체지방량 추이 그래프' })).toHaveCount(0)
    await page.getByRole('radio', { name: '기록 없음' }).click()
    await expect(page.getByText('첫 인바디 기록을 남겨 보세요')).toBeVisible()
    await page.getByRole('link', { name: /결과지 사진으로 등록/ }).click()
    await expect(page).toHaveURL('/record/inbody')
    await expect(page.getByText('어디에도 올리지 않아요', { exact: false })).toBeVisible()
    await expect(page.getByText('인바디 앱', { exact: false }).first()).toBeVisible()
  })
})

test.describe('홈 인사말 이름', () => {
  test('예시 사용자: 가입 이름에서 성을 뺀 이름 (닉네임 아님)', async ({ page }) => {
    await page.goto('/home')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/^지원님, /)
    await expect(page.getByRole('heading', { level: 1 })).not.toContainText('산뜻한레몬')
  })

  test('이메일 가입 이름 → 온보딩 → 홈에 성 뺀 이름', async ({ page }) => {
    await page.goto('/signup')
    await page.getByLabel(/^이름/).fill('이민호')
    await page.getByLabel('이메일').fill('minho@example.com')
    await page.getByLabel('비밀번호', { exact: true }).fill('abc12345')
    await page.getByLabel('비밀번호 확인').fill('abc12345')
    await page.getByRole('button', { name: '다음' }).click()
    await page.getByRole('checkbox', { name: /전체 동의/ }).click()
    await page.getByRole('button', { name: '동의하고 시작하기' }).click()
    await expect(page.getByText('사용할 수 있는 닉네임이에요.')).toBeVisible()
    await page.getByRole('button', { name: '이 닉네임으로 계속하기' }).click()
    await page.getByRole('button', { name: '나중에 입력' }).click()
    await page.getByRole('radio', { name: /나중에 기록할게요/ }).click()
    await page.getByRole('button', { name: '슬림로그 시작하기' }).click()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/^민호님, /)
  })
})

test('설정: 단백질 목표 저장 → 식단 분석 단백질 그래프에 목표선, 잘못된 값은 저장 막힘', async ({ page }) => {
  await page.goto('/my/settings/app')
  const save = page.getByRole('button', { name: '저장' })
  await expect(save).toBeDisabled() // 바뀐 게 없으면 저장 비활성
  await page.getByLabel('하루 단백질 목표').fill('500')
  await expect(page.getByRole('alert')).toHaveText(/0~400g/)
  await expect(save).toBeDisabled()
  await page.getByLabel('하루 단백질 목표').fill('60')
  await save.click()
  await expect(page.getByText('목업: 화면에만 저장됐어요')).toBeVisible()
  // 목업은 화면 메모리에만 저장 → 새로고침 없이 앱 안에서 이동
  await page.evaluate(() => {
    history.pushState({}, '', '/analysis/nutrition')
    dispatchEvent(new PopStateEvent('popstate'))
  })
  const notice = page.getByRole('dialog', { name: '분석 결과를 확인하기 전에' })
  await notice.getByRole('button', { name: '확인했어요' }).click({ timeout: 2000 }).catch(() => {})
  await expect(page.getByRole('img', { name: /단백질 막대 그래프, 목표 60g 점선/ })).toBeVisible()
  await expect(page.getByText(/목표 60g 넘긴 날/)).toBeVisible()
})

test('설정: 화면 밝기 어둡게 → 바로 적용되고 새로고침 후에도 유지', async ({ page }) => {
  await page.goto('/my/settings/app')
  const html = page.locator('html')
  await expect(html).not.toHaveAttribute('data-slimlog-theme', 'dark')
  await page.getByRole('radio', { name: '어둡게' }).click()
  await expect(html).toHaveAttribute('data-slimlog-theme', 'dark')
  await page.reload()
  await expect(html).toHaveAttribute('data-slimlog-theme', 'dark')
  await expect(page.getByRole('radio', { name: '어둡게' })).toHaveAttribute('aria-checked', 'true')
  await page.getByRole('radio', { name: '밝게' }).click()
  await expect(html).not.toHaveAttribute('data-slimlog-theme', 'dark')
})

test('증상 수정: 빠른 기록과 같은 모양(강도 약함/보통/심함·지속)으로 고치고 목록에 반영', async ({ page }) => {
  await page.goto('/record/symptom')
  await page.getByRole('link', { name: /기록 수정$/ }).first().click()
  await expect(page.getByRole('heading', { name: '증상 기록 수정' })).toBeVisible()
  await page.getByRole('radiogroup', { name: '증상 종류' }).getByRole('radio', { name: '두통' }).click()
  await page.getByRole('radiogroup', { name: '두통 강도' }).getByRole('radio', { name: '심함' }).click()
  await page.getByRole('radiogroup', { name: '두통 지속' }).getByRole('radio', { name: '지속 중' }).click()
  await page.getByLabel('추가 메모').fill('오후 내내')
  await page.getByRole('button', { name: '수정 저장' }).click()
  await expect(page).toHaveURL('/record/symptom')
  await expect(page.getByRole('link', { name: '두통 기록 수정' }).first()).toContainText('지속 중 · 오후 내내')
})

test('설정에서 분석 유의사항 다시 보기', async ({ page }) => {
  await page.goto('/my/settings/app')
  await page.getByRole('button', { name: '다시 보기' }).click()
  await page.goto('/analysis')
  await expect(page.getByRole('dialog', { name: '분석 결과를 확인하기 전에' })).toBeVisible()
})


test.describe('식단 기록', () => {
  const kcalTotal = (page: import('@playwright/test').Page) => page.getByText('총 섭취 열량').locator('..')
  const saveBtn = (page: import('@playwright/test').Page) => page.getByRole('button', { name: /식단 (저장|수정)하기/ })

  test('1. 사진 1장 → 멀티라벨 인식(목업) → 확인 필요 고르기·수정·제외 → 저장', async ({ page }) => {
    await page.goto('/record/meal/new')
    await page.getByRole('button', { name: '예시 사진' }).click()
    // 영역 그리기 UI는 없다
    await expect(page.getByRole('application')).toHaveCount(0)
    await expect(page.getByText('영역')).toHaveCount(0)
    await expect(page.getByText('고정된 예시 결과', { exact: false })).toBeVisible()
    await page.getByRole('button', { name: '음식 인식하기' }).click()
    await expect(page).toHaveURL('/record/meal/review')
    await expect(page.getByText('5개 음식')).toBeVisible()
    await expect(page.getByText('목업 인식 결과')).toBeVisible()
    await expect(page.getByText('인식 결과', { exact: true })).toHaveCount(3)
    await expect(page.getByText('확인 필요', { exact: true })).toHaveCount(2)
    // 신뢰도 % 는 보여주지 않는다
    await expect(page.getByText(/\d+(\.\d+)?\s?%/)).toHaveCount(0)
    await expect(saveBtn(page)).toBeDisabled()
    // 확인 필요 1: 후보에서 고르기
    await page.getByRole('radiogroup', { name: '확인 필요 1 인식 후보' }).getByRole('radio', { name: '시금치나물' }).click()
    await expect(page.getByText('확인 완료', { exact: true })).toHaveCount(1)
    // 확인 필요 2: 검색해서 고르기
    await page.getByRole('button', { name: '검색해서 고르기' }).click()
    const sheet = page.getByRole('dialog', { name: '음식 검색' })
    await sheet.getByLabel('음식 검색').fill('계란말이')
    await sheet.getByRole('button', { name: /^계란말이 100g당/ }).click()
    // 인식 결과 수정 + 제외
    await page.getByRole('radiogroup', { name: '김치찌개 인식 후보' }).getByRole('radio', { name: '순두부찌개' }).click()
    await expect(page.getByText('직접 고침').first()).toBeVisible()
    await page.getByRole('button', { name: '배추김치 제외' }).click()
    await expect(page.getByText('4개 음식')).toBeVisible()
    await page.getByRole('radio', { name: '저녁' }).click()
    await saveBtn(page).click()
    await expect(page).toHaveURL('/record/meal')
    const card = page.getByRole('region', { name: /^저녁 .* 식사 기록$/ }).first()
    await expect(card).toContainText('사진 1장')
    await expect(card).toContainText('순두부찌개')
    await expect(card).toContainText('계란말이')
    await expect(card).toContainText('시금치나물')
    await expect(card).not.toContainText('배추김치')
  })

  test('2. 사진 1장 → 인식 → 확인 필요 빼고 음식 직접 추가 → 저장', async ({ page }) => {
    await page.goto('/record/meal/new')
    await page.getByRole('button', { name: '예시 사진' }).click()
    await page.getByRole('button', { name: '음식 인식하기' }).click()
    await page.getByRole('button', { name: '확인 필요 1 제외' }).click()
    await page.getByRole('button', { name: '확인 필요 1 제외' }).click()
    await expect(page.getByText('3개 음식')).toBeVisible()
    await page.getByRole('button', { name: '음식 직접 추가하기' }).click()
    await page.getByLabel('음식 검색').fill('콩나물')
    await page.getByRole('button', { name: '콩나물무침 1인분 바로 추가' }).click()
    await expect(page.getByText('4개 음식')).toBeVisible()
    await expect(page.getByText('직접 검색', { exact: false })).toHaveCount(1)
    await saveBtn(page).click()
    await expect(page).toHaveURL('/record/meal')
    await expect(page.getByText('직접 추가').first()).toBeVisible()
  })

  test('3·5. 사진 없이 검색 → 선택 → 영양 자동 입력 → 100g→200g 재계산 → 저장', async ({ page }) => {
    await page.goto('/record/meal/new')
    await page.getByRole('link', { name: /음식명 또는 제품명/ }).click()
    await page.getByLabel('음식 검색').fill('닭가슴')
    await page.getByRole('button', { name: /^닭가슴살 100g당/ }).click()
    await expect(page.getByText('100g당').first()).toBeVisible()
    const grams = page.getByLabel('직접 입력')
    await grams.fill('100')
    await expect(page.getByText('섭취량 100g 기준', { exact: false })).toBeVisible()
    await expect(page.getByText('110 kcal')).toBeVisible()
    await grams.fill('200')
    await expect(page.getByText('220 kcal')).toBeVisible()
    await expect(page.getByText('46g')).toBeVisible() // 단백질 23g × 2
    await page.getByRole('button', { name: '식단에 추가' }).click()
    await expect(page).toHaveURL('/record/meal/review')
    await saveBtn(page).click()
    await expect(page.getByText('사진 없이 기록').first()).toBeVisible()
  })

  test('4·6. 음식 3개 연속 추가 → 합계 → 삭제하면 즉시 반영', async ({ page }) => {
    await page.goto('/record/meal/search')
    // 쌀밥 1공기(210g) 바로 담기
    await page.getByLabel('음식 검색').fill('쌀밥')
    await page.getByRole('button', { name: '쌀밥 1인분 바로 추가' }).click()
    // 닭가슴살 100g
    await page.getByLabel('음식 검색').fill('닭가슴살')
    await page.getByRole('button', { name: /^닭가슴살 100g당/ }).click()
    await page.getByLabel('직접 입력').fill('100')
    await page.getByRole('button', { name: '식단에 추가' }).click()
    // 배추김치 50g — 작성 화면의 '음식 직접 추가하기'에서
    await page.getByRole('button', { name: '음식 직접 추가하기' }).click()
    await page.getByLabel('음식 검색').fill('배추김치')
    await page.getByRole('button', { name: '배추김치 1인분 바로 추가' }).click()
    await expect(page.getByText('3개 음식')).toBeVisible()
    // 310 + 110 + 9 = 429
    await expect(kcalTotal(page)).toContainText('429 kcal')
    await page.getByRole('button', { name: '닭가슴살 제외' }).click()
    await expect(kcalTotal(page)).toContainText('319 kcal')
    await saveBtn(page).click()
    await expect(page).toHaveURL('/record/meal')
  })

  test('7. 검색 결과 없음 → 직접 음식 등록(영양소 비우면 정보 없음) → 식단 추가', async ({ page }) => {
    await page.goto('/record/meal/search')
    await page.getByLabel('음식 검색').fill('엄마표곤드레밥')
    await expect(page.getByText('찾으시는 음식이 없나요?')).toBeVisible()
    await page.getByRole('button', { name: '직접 음식 등록하기' }).click()
    await expect(page.getByLabel(/음식명/)).toHaveValue('엄마표곤드레밥')
    await page.getByLabel(/기준 제공량/).fill('250')
    await page.getByLabel(/^칼로리/).fill('380')
    await page.getByRole('button', { name: '내 음식으로 등록' }).click()
    await expect(page.getByRole('heading', { name: '엄마표곤드레밥' })).toBeVisible()
    await expect(page.getByText('정보 없음').first()).toBeVisible()
    await page.getByRole('button', { name: '식단에 추가' }).click()
    await expect(page.getByText('영양 정보가 없는 음식이 있어', { exact: false })).toBeVisible()
    // 새로고침 없이 다시 검색하면 내 음식으로 나온다
    await page.getByRole('button', { name: '음식 직접 추가하기' }).click()
    await page.getByLabel('음식 검색').fill('곤드레')
    await expect(page.getByText('내 음식', { exact: true })).toBeVisible()
  })

  test('8. 저장된 식단 수정 및 삭제', async ({ page }) => {
    await page.goto('/record/meal')
    await page.getByRole('button', { name: /^아침 08:10 기록 수정/ }).click()
    await expect(page.getByRole('heading', { name: '식단 수정' })).toBeVisible()
    await page.getByRole('button', { name: '바나나 제외' }).click()
    await saveBtn(page).click()
    const card = page.getByRole('region', { name: '아침 08:10 식사 기록' })
    await expect(card).not.toContainText('바나나')
    await page.getByRole('button', { name: '아침 08:10 기록 삭제' }).click()
    await page.getByRole('dialog').getByRole('button', { name: '삭제', exact: true }).click()
    await expect(page.getByRole('region', { name: '아침 08:10 식사 기록' })).toHaveCount(0)
  })

  test('9. 같은 끼니라도 따로 저장한 식사는 섞이지 않는다', async ({ page }) => {
    await page.goto('/record/meal')
    for (const food of ['바나나', '사과']) {
      // 목업 상태는 새로고침하면 초기화되므로 앱 안에서 이동
      await page.getByRole('button', { name: '기록하기' }).click()
      await page.getByRole('link', { name: /음식명 또는 제품명/ }).click()
      await page.getByLabel('음식 검색').fill(food)
      await page.getByRole('button', { name: `${food} 1인분 바로 추가` }).click()
      await page.getByRole('button', { name: '뒤로 가기' }).click()
      await page.getByRole('radio', { name: '간식' }).click()
      await saveBtn(page).click()
      await expect(page).toHaveURL('/record/meal')
    }
    const snackCards = page.getByRole('region', { name: /^간식 .* 식사 기록$/ })
    // 예시 간식 1건 + 새로 저장한 2건
    await expect(snackCards).toHaveCount(3)
  })
})
