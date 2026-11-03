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
  { path: '/my', heading: '마이' },
  { path: '/my/consent', heading: '동의 관리' },
  { path: '/my/settings', heading: '기록 · 알림 설정' },
  { path: '/my/eyebody-data', heading: '눈바디 로컬 데이터' },
  { path: '/my/account', heading: '계정 관리' },
  { path: '/my/profile', heading: '프로필' },
  { path: '/login', heading: 'SlimLog 로그인' },
  { path: '/signup', heading: '이메일로 가입' },
  { path: '/consent', heading: '약관 동의' },
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
  const chart = page.getByRole('img', { name: '참고용 잔존량 상대값 곡선' })
  const box = (await chart.boundingBox())!
  await page.mouse.move(box.x + box.width * 0.6, box.y + box.height / 2)
  await expect(page.getByText(/최고 시점 대비 \d+%/).first()).toBeVisible()
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
    await expect(page).toHaveURL('/onboarding/first-dose')
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

  test('로그아웃 → 로그인 화면', async ({ page }) => {
    await page.goto('/my')
    await page.getByRole('button', { name: '로그아웃' }).click()
    await page.getByRole('dialog').getByRole('button', { name: '로그아웃' }).click()
    await expect(page).toHaveURL('/login')
  })
})
