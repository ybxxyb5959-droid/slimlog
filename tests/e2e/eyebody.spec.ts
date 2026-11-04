import { expect, test, type Page } from '@playwright/test'

/** 눈바디 — 기록 보기 | 변화 비교, 정면·측면·후면, 캘린더, 교체 확인, 확대, 잠금, 예전 데이터 호환 (목업 모드) */

const onlyMobile = () => test.skip(test.info().project.name !== 'mobile-390', '한 화면 크기에서만')
const PW = 'eyebody1'
const NOTICE = '사진은 현재 기기에만 저장되며, 앱 삭제·데이터 삭제·기기 변경 시 복구되지 않을 수 있습니다'

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

async function createVault(page: Page) {
  await page.goto('/record/eyebody')
  await expect(page.getByText('눈바디 비밀번호 만들기')).toBeVisible()
  await expect(page.getByText(NOTICE, { exact: false })).toBeVisible()
  await page.getByLabel('비밀번호 (6자 이상)').fill(PW)
  await page.getByLabel('비밀번호 확인').fill(PW)
  await page.getByRole('button', { name: '만들기' }).click()
  await expect(page.getByRole('tablist', { name: '눈바디 화면' })).toBeVisible()
}

/** 바텀시트 [카메라 | 앨범] → 각도 → 앨범 파일 */
async function register(page: Page, angle: '정면' | '측면' | '후면', color: string) {
  const open = page.getByRole('button', { name: /사진 등록하기|다시 찍기/ }).first()
  await expect(open).toBeEnabled() // 앞 사진 저장이 끝날 때까지
  await expect(page.getByRole('dialog')).toHaveCount(0) // 앞 창이 다 닫힌 뒤에
  await open.click()
  const sheet = page.getByRole('dialog', { name: '사진 등록' })
  await expect(sheet.getByRole('button', { name: '카메라' })).toBeVisible()
  await expect(sheet.getByRole('button', { name: '앨범' })).toBeVisible()
  await sheet.getByRole('tablist', { name: '등록할 각도' }).getByRole('tab', { name: angle }).click()
  await page.getByLabel('눈바디 사진 선택').setInputFiles(await jpeg(page, color))
}

const day = (d: Date) => `${d.getMonth() + 1}월 ${d.getDate()}일`

test('기록 보기: 오늘 기본 선택 · 빈 상태 → 정면·측면 등록 · 각도 탭 항상 표시 · 초록 점 · 암호화 저장 · 서버 전송 없음', async ({ page }) => {
  onlyMobile()
  const external: string[] = []
  page.on('request', (r) => {
    const u = new URL(r.url())
    if (u.hostname !== 'localhost' && u.protocol.startsWith('http')) external.push(r.url())
  })
  await createVault(page)
  const now = new Date()
  await expect(page.getByRole('heading', { name: `${now.getFullYear()}년 ${now.getMonth() + 1}월 ${now.getDate()}일` })).toBeVisible()
  await expect(page.getByText('등록된 변화가 없어요')).toBeVisible()
  await expect(page.getByText('오늘의 모습을 사진으로 남겨보세요')).toBeVisible()
  const angles = page.getByRole('tablist', { name: '사진 각도' })
  for (const a of ['정면', '측면', '후면']) await expect(angles.getByRole('tab', { name: a })).toBeVisible()
  // 캘린더 기본 펼침 + 오늘 선택
  await expect(page.getByRole('button', { name: '기록 캘린더 접기' })).toHaveAttribute('aria-expanded', 'true')
  const todayCell = page.getByRole('gridcell', { name: new RegExp(`^${day(now)}`) })
  await expect(todayCell).toHaveAttribute('aria-selected', 'true')
  await expect(todayCell).not.toHaveAccessibleName(/사진 있음/)

  await register(page, '정면', '#d9a066')
  await expect(page.getByText('눈바디 사진을 저장했어요')).toBeVisible()
  await expect(page.getByRole('img', { name: /정면 눈바디$/ })).toBeVisible()
  await expect(todayCell).toHaveAccessibleName(/사진 있음/)
  // 측면 탭: 사진 없으면 등록 안내
  await angles.getByRole('tab', { name: '측면' }).click()
  await expect(page.getByText('이 날 측면 사진은 아직 없어요')).toBeVisible()
  await register(page, '측면', '#88aa66')
  await expect(page.getByRole('img', { name: /측면 눈바디$/ })).toBeVisible()

  // 저장된 바이트는 JPEG 가 아니다 (암호화됨), 각도가 함께 저장됨
  const rows = await page.evaluate(
    () =>
      new Promise<{ head: number[]; angle: string }[]>((resolve) => {
        const req = indexedDB.open('slimlog-eyebody')
        req.onsuccess = () => {
          const g = req.result.transaction('photos').objectStore('photos').getAll()
          g.onsuccess = () => resolve(g.result.map((r: { data: ArrayBuffer; angle: string }) => ({ head: Array.from(new Uint8Array(r.data).slice(0, 2)), angle: r.angle })))
        }
      }),
  )
  expect(rows.map((r) => r.angle).sort()).toEqual(['front', 'side'])
  for (const r of rows) expect(r.head).not.toEqual([0xff, 0xd8])
  expect(external).toEqual([])
})

test('같은 날짜·같은 각도 → 교체 전 확인창 · 취소하면 그대로 · 바꾸기 누르면 1장으로 교체', async ({ page }) => {
  onlyMobile()
  await createVault(page)
  await register(page, '정면', '#d9a066')
  await expect(page.getByRole('img', { name: /정면 눈바디$/ })).toBeVisible()
  await register(page, '정면', '#3366cc')
  const confirm = page.getByRole('dialog', { name: /정면 사진을 바꿀까요/ })
  await expect(confirm).toBeVisible()
  await confirm.getByRole('button', { name: '취소' }).click()
  await expect(confirm).toHaveCount(0)
  await expect(page.getByRole('img', { name: /정면 눈바디$/ })).toBeVisible() // 취소하면 기존 사진 그대로
  await register(page, '정면', '#3366cc')
  await page.getByRole('dialog', { name: /정면 사진을 바꿀까요/ }).getByRole('button', { name: '바꾸기' }).click()
  await expect(page.getByText('정면 사진을 바꿨어요')).toBeVisible()
  const count = await page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        const req = indexedDB.open('slimlog-eyebody')
        req.onsuccess = () => {
          const g = req.result.transaction('photos').objectStore('photos').count()
          g.onsuccess = () => resolve(g.result)
        }
      }),
  )
  expect(count).toBe(1)
})

test('캘린더: 이전 달 날짜 선택 → 사진 즉시 변경 · 미래 날짜 선택 불가 · 탭으로 접기/펼치기', async ({ page }) => {
  onlyMobile()
  await createVault(page)
  await register(page, '정면', '#d9a066')
  const prev = new Date()
  prev.setDate(1)
  prev.setMonth(prev.getMonth() - 1)
  prev.setDate(15)
  await page.getByRole('button', { name: '이전 달' }).click()
  await page.getByRole('gridcell', { name: new RegExp(`^${day(prev)}`) }).click()
  await expect(page.getByRole('heading', { name: `${prev.getFullYear()}년 ${prev.getMonth() + 1}월 15일` })).toBeVisible()
  await expect(page.getByText('등록된 변화가 없어요')).toBeVisible()
  await register(page, '정면', '#6699cc')
  await expect(page.getByRole('gridcell', { name: new RegExp(`^${day(prev)}, 사진 있음`) })).toBeVisible()
  // 다음 달(이번 달)로 → 미래 날짜는 비활성
  await page.getByRole('button', { name: '다음 달' }).click()
  await expect(page.getByRole('button', { name: '다음 달' })).toBeDisabled()
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  if (tomorrow.getMonth() === new Date().getMonth()) await expect(page.getByRole('gridcell', { name: new RegExp(`^${day(tomorrow)}`) })).toBeDisabled()
  // 접기 → 펼치기
  await page.getByRole('button', { name: '기록 캘린더 접기' }).click()
  await expect(page.getByRole('grid')).toHaveCount(0)
  await page.getByRole('button', { name: '기록 캘린더 펼치기' }).click()
  await expect(page.getByRole('grid')).toBeVisible()
})

test('변화 비교: 사진 부족 안내 → 2일 등록 후 사진 있는 날짜만 드롭다운 · 각도별 비교 · 없는 각도 안내 · 확대', async ({ page }) => {
  onlyMobile()
  await createVault(page)
  await page.getByRole('tab', { name: '변화 비교' }).click()
  await expect(page.getByText('비교할 사진이 부족해요')).toBeVisible()
  await page.getByRole('tab', { name: '기록 보기' }).click()
  await register(page, '정면', '#d9a066')
  await register(page, '측면', '#88aa66')
  const prev = new Date()
  prev.setDate(1)
  prev.setMonth(prev.getMonth() - 1)
  prev.setDate(10)
  await page.getByRole('button', { name: '이전 달' }).click()
  await page.getByRole('gridcell', { name: new RegExp(`^${day(prev)}`) }).click()
  await page.getByRole('tablist', { name: '사진 각도' }).getByRole('tab', { name: '정면' }).click()
  await register(page, '정면', '#6699cc')

  await page.getByRole('tab', { name: '변화 비교' }).click()
  await expect(page).toHaveURL(/tab=compare/)
  const before = page.getByLabel('이전 날짜')
  await expect(before.locator('option')).toHaveCount(2) // 사진 있는 날짜만
  await expect(page.getByRole('img', { name: /^이전 .* 정면 눈바디$/ })).toBeVisible()
  await expect(page.getByRole('img', { name: /^최근 .* 정면 눈바디$/ })).toBeVisible()
  // 측면: 이전 날짜엔 없음 → 안내
  await page.getByRole('tablist', { name: '비교 각도' }).getByRole('tab', { name: '측면' }).click()
  await expect(page.getByText('이 날 측면 사진이 없어요')).toBeVisible()
  await expect(page.getByRole('img', { name: /^최근 .* 측면 눈바디$/ })).toBeVisible()
  // 확대
  await page.getByRole('button', { name: /^최근 .* 측면 사진 크게 보기$/ }).click()
  const zoom = page.getByRole('dialog')
  await zoom.getByRole('button', { name: '확대' }).click()
  await expect(zoom.getByText('1.5배')).toBeVisible()
  await expect(zoom.getByRole('button', { name: /저장|다운로드|공유/ })).toHaveCount(0)
  await zoom.getByRole('button', { name: '닫기' }).click()
  await expect(zoom).toHaveCount(0)
  // 예전 비교 주소는 변화 비교 탭으로
  await page.goto('/record/eyebody/compare')
  await expect(page).toHaveURL(/\/record\/eyebody\?tab=compare/)
})

test('수정(각도 바꾸기) · 삭제 · 설정에서 잠그기 → 틀린 비밀번호 → 해제', async ({ page }) => {
  onlyMobile()
  await createVault(page)
  await register(page, '정면', '#d9a066')
  await page.getByRole('button', { name: '수정' }).click()
  const edit = page.getByRole('dialog', { name: '사진 정보 수정' })
  await edit.getByRole('tablist', { name: '수정할 각도' }).getByRole('tab', { name: '후면' }).click()
  await edit.getByRole('button', { name: '저장' }).click()
  await expect(page.getByText('사진 정보를 바꿨어요')).toBeVisible()
  await expect(page.getByRole('tablist', { name: '사진 각도' }).getByRole('tab', { name: /후면/ })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('img', { name: /후면 눈바디$/ })).toBeVisible()

  // 설정 → 안내 문구 · 지금 잠그기
  await page.getByRole('button', { name: '눈바디 설정' }).click()
  const settings = page.getByRole('dialog', { name: '눈바디 설정' })
  await expect(settings.getByText(NOTICE, { exact: false })).toBeVisible()
  await settings.getByRole('button', { name: '지금 잠그기' }).click()
  await page.getByLabel('비밀번호 (6자 이상)').fill('wrongpw')
  await page.getByRole('button', { name: '잠금 해제' }).click()
  await expect(page.getByRole('alert')).toContainText('비밀번호가 맞지 않아요')
  await page.getByLabel('비밀번호 (6자 이상)').fill(PW)
  await page.getByRole('button', { name: '잠금 해제' }).click()
  await page.getByRole('tablist', { name: '사진 각도' }).getByRole('tab', { name: /후면/ }).click()
  await expect(page.getByRole('img', { name: /후면 눈바디$/ })).toBeVisible()

  await page.getByRole('button', { name: '삭제' }).click()
  await page.getByRole('dialog').getByRole('button', { name: '삭제', exact: true }).click()
  await expect(page.getByText('등록된 변화가 없어요')).toBeVisible()
})

test('예전 형식 금고(각도 없음·31만 회) → 새 화면에서 같은 비밀번호로 열리고 정면으로 보임, 데이터는 그대로', async ({ page }) => {
  onlyMobile()
  await page.goto('/home')
  // 예전 코드와 같은 방식으로 직접 만든 금고 + 사진 1장(angle 칸 없음)
  const dateKey = await page.evaluate(async (pw) => {
    const te = new TextEncoder()
    const salt = crypto.getRandomValues(new Uint8Array(16))
    const base = await crypto.subtle.importKey('raw', te.encode(pw), 'PBKDF2', false, ['deriveKey'])
    const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 310_000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
    const enc = async (data: BufferSource) => {
      const iv = crypto.getRandomValues(new Uint8Array(12))
      return { iv, data: await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data) }
    }
    const cv = document.createElement('canvas')
    cv.width = 300
    cv.height = 400
    cv.getContext('2d')!.fillStyle = '#aa5533'
    cv.getContext('2d')!.fillRect(0, 0, 300, 400)
    const jpg = await (await new Promise<Blob>((r) => cv.toBlob((b) => r(b!), 'image/jpeg'))).arrayBuffer()
    const v = await enc(te.encode('slimlog-eyebody-ok'))
    const a = await enc(jpg)
    const b = await enc(jpg)
    const d = new Date()
    d.setDate(d.getDate() - 3)
    const takenAt = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open('slimlog-eyebody', 1)
      req.onupgradeneeded = () => {
        req.result.createObjectStore('meta')
        req.result.createObjectStore('photos', { keyPath: 'id' })
      }
      req.onsuccess = () => {
        const t = req.result.transaction(['meta', 'photos'], 'readwrite')
        t.objectStore('meta').put({ salt, iv: v.iv, check: v.data }, 'key')
        t.objectStore('photos').put({ id: 'legacy-1', takenAt, createdAt: new Date().toISOString(), iv: a.iv, data: a.data, thumbIv: b.iv, thumb: b.data })
        t.oncomplete = () => resolve()
        t.onerror = () => reject(t.error)
      }
    })
    return takenAt
  }, PW)

  await page.goto('/record/eyebody')
  await expect(page.getByText('눈바디 잠금 해제')).toBeVisible()
  await page.getByLabel('비밀번호 (6자 이상)').fill(PW)
  await page.getByRole('button', { name: '잠금 해제' }).click()
  const d = new Date(`${dateKey}T12:00:00`)
  if (d.getMonth() !== new Date().getMonth()) await page.getByRole('button', { name: '이전 달' }).click()
  await page.getByRole('gridcell', { name: new RegExp(`^${day(d)}, 사진 있음`) }).click()
  await expect(page.getByRole('img', { name: /정면 눈바디$/ })).toBeVisible()
  // 저장된 행은 고치지 않음 (angle 칸이 여전히 없음 → 읽을 때만 정면으로 봄)
  const stored = await page.evaluate(
    () =>
      new Promise<{ hasAngle: boolean; hasIter: boolean }>((resolve) => {
        const req = indexedDB.open('slimlog-eyebody')
        req.onsuccess = () => {
          const t = req.result.transaction(['meta', 'photos'])
          const p = t.objectStore('photos').get('legacy-1')
          const m = t.objectStore('meta').get('key')
          t.oncomplete = () => resolve({ hasAngle: 'angle' in p.result, hasIter: 'iter' in m.result })
        }
      }),
  )
  expect(stored).toEqual({ hasAngle: false, hasIter: false })
})

test('작은 화면(320×568)에서도 사진 영역과 캘린더가 겹치지 않음', async ({ page }) => {
  onlyMobile()
  await page.setViewportSize({ width: 320, height: 568 })
  await createVault(page)
  await register(page, '정면', '#d9a066')
  const photo = await page.getByRole('button', { name: /정면 사진 크게 보기/ }).boundingBox()
  const cal = await page.getByRole('region', { name: '기록 캘린더' }).boundingBox()
  expect(photo && cal).toBeTruthy()
  expect(photo!.y + photo!.height).toBeLessThanOrEqual(cal!.y)
  const scrollW = await page.evaluate(() => document.documentElement.scrollWidth)
  expect(scrollW).toBeLessThanOrEqual(320)
})
