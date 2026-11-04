import { expect, test, type Page } from '@playwright/test'

/**
 * 눈바디 잠금 v2 — 데이터 열쇠(DEK)와 비밀번호 분리, 복구 코드, 비밀번호 변경·재설정, 지문(테스트용 가짜), 자동 잠금, 이전 중단 후 이어하기.
 * 지문은 테스트 빌드(VITE_E2E_HOOKS=1)의 메모리 가짜 저장소로 흐름만 검증한다. 실제 Keystore 동작은 갤럭시 실기기에서 확인.
 */
const onlyMobile = () => test.skip(test.info().project.name !== 'mobile-390', '한 화면 크기에서만')
const PW = 'eyebody1'

async function jpeg(page: Page, color: string) {
  const b64 = await page.evaluate((c) => {
    const cv = document.createElement('canvas')
    cv.width = 300
    cv.height = 400
    const g = cv.getContext('2d')!
    g.fillStyle = c
    g.fillRect(0, 0, 300, 400)
    return cv.toDataURL('image/jpeg', 0.9).split(',')[1]
  }, color)
  return { name: 'body.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(b64, 'base64') }
}

async function create(page: Page, pw = PW) {
  await page.goto('/record/eyebody')
  await page.getByLabel('비밀번호 (6자 이상)').fill(pw)
  await page.getByLabel('비밀번호 확인').fill(pw)
  await page.getByRole('button', { name: '만들기' }).click()
  const code = (await page.getByLabel('복구 코드').textContent())!.trim()
  await page.getByLabel('안전한 곳에 적어 뒀어요').check()
  await page.getByRole('button', { name: '확인' }).click()
  await expect(page.getByRole('tablist', { name: '눈바디 화면' })).toBeVisible()
  return code
}
async function addFront(page: Page) {
  await page.getByRole('button', { name: '사진 등록하기' }).click()
  await page.getByLabel('눈바디 사진 선택').setInputFiles(await jpeg(page, '#cc8855'))
  await expect(page.getByRole('img', { name: /정면 눈바디$/ })).toBeVisible()
}
async function lockNow(page: Page) {
  await page.getByRole('button', { name: '눈바디 설정' }).click()
  await page.getByRole('button', { name: '지금 잠그기' }).click()
  await expect(page.getByText('눈바디 잠금 해제')).toBeVisible()
}
async function unlockPw(page: Page, pw: string) {
  await page.getByLabel('비밀번호 (6자 이상)').fill(pw)
  await page.getByRole('button', { name: '잠금 해제' }).click()
}
/** 저장 구조 엿보기 — 비밀번호·복구 코드·DEK 평문이 어디에도 없는지 */
async function rawStore(page: Page) {
  return page.evaluate(
    () =>
      new Promise<{ metaKeys: string[]; v2: Record<string, unknown>; text: string }>((resolve) => {
        const req = indexedDB.open('slimlog-eyebody')
        req.onsuccess = () => {
          const t = req.result.transaction(['meta'])
          const keys = t.objectStore('meta').getAllKeys()
          const v2 = t.objectStore('meta').get('v2')
          t.oncomplete = () => {
            const v = v2.result
            resolve({ metaKeys: keys.result as string[], v2: { ...v, pw: { kdf: v.pw.kdf, iter: v.pw.iter, saltLen: v.pw.salt.length }, rc: { iter: v.rc.iter, saltLen: v.rc.salt.length } }, text: JSON.stringify(v, (_k, x) => (x instanceof ArrayBuffer || ArrayBuffer.isView(x) ? Array.from(new Uint8Array(x as ArrayBuffer)) : x)) })
          }
        }
      }),
  )
}

test('새 금고: DEK 분리 구조(비밀번호 60만 회·salt 16B, 복구 코드 별도 감쌈) · 비밀번호·코드 평문 저장 없음', async ({ page }) => {
  onlyMobile()
  const code = await create(page)
  const s = await rawStore(page)
  expect(s.metaKeys).toEqual(['v2'])
  expect(s.v2).toMatchObject({ version: 2, pw: { kdf: 'PBKDF2-SHA256', iter: 600_000, saltLen: 16 }, rc: { iter: 100_000, saltLen: 16 }, rcConfirmed: true, bio: false, migration: 'done' })
  const bytes = (str: string) => JSON.stringify(Array.from(new TextEncoder().encode(str))).slice(1, -1)
  expect(s.text).not.toContain(bytes(PW))
  expect(s.text).not.toContain(bytes(code.replace(/-/g, '')))
})

test('비밀번호 분실 → 복구 코드(소문자·띄어쓰기 섞어도 됨)로 열고 새 비밀번호 → 예전 비밀번호는 안 됨, 사진 그대로', async ({ page }) => {
  onlyMobile()
  const code = await create(page)
  await addFront(page)
  await lockNow(page)
  await page.getByRole('button', { name: '비밀번호를 잊었어요' }).click()
  await page.getByRole('button', { name: /복구 코드로 열고/ }).click()
  await page.getByLabel('복구 코드 (24자리)').fill('ABCD-EFGH-JKMN-PQRS-TVWX-YZ01')
  await page.getByRole('button', { name: '복구 코드로 열기' }).click()
  await expect(page.getByRole('alert')).toContainText('복구 코드가 맞지 않아요')
  await page.getByLabel('복구 코드 (24자리)').fill(code.toLowerCase().replace(/-/g, ' '))
  await page.getByRole('button', { name: '복구 코드로 열기' }).click()
  await page.getByLabel('새 비밀번호 (6자 이상)').fill('newpass9')
  await page.getByLabel('새 비밀번호 확인').fill('newpass9')
  await page.getByRole('button', { name: '새 비밀번호로 저장' }).click()
  await expect(page.getByText('새 비밀번호로 바꿨어요')).toBeVisible()
  await expect(page.getByRole('img', { name: /정면 눈바디$/ })).toBeVisible()
  await lockNow(page)
  await unlockPw(page, PW)
  await expect(page.getByRole('alert')).toContainText('비밀번호가 맞지 않아요')
  await unlockPw(page, 'newpass9')
  await expect(page.getByRole('img', { name: /정면 눈바디$/ })).toBeVisible()
  // 복구 코드는 계속 유효
  await lockNow(page)
  await page.getByRole('button', { name: '비밀번호를 잊었어요' }).click()
  await page.getByRole('button', { name: /복구 코드로 열고/ }).click()
  await page.getByLabel('복구 코드 (24자리)').fill(code)
  await page.getByRole('button', { name: '복구 코드로 열기' }).click()
  await expect(page.getByLabel('새 비밀번호 (6자 이상)')).toBeVisible()
})

test('설정: 비밀번호 변경 · 복구 코드 새로 만들기(예전 코드 무효)', async ({ page }) => {
  onlyMobile()
  const oldCode = await create(page)
  await page.getByRole('button', { name: '눈바디 설정' }).click()
  await page.getByRole('button', { name: '비밀번호 변경' }).click()
  await page.getByLabel('지금 비밀번호').fill('wrong12')
  await page.getByLabel('새 비밀번호 (6자 이상)').fill('second2')
  await page.getByLabel('새 비밀번호 확인').fill('second2')
  await page.getByRole('button', { name: '비밀번호 변경' }).click()
  await expect(page.getByRole('alert')).toContainText('지금 비밀번호가 맞지 않아요')
  await page.getByLabel('지금 비밀번호').fill(PW)
  await page.getByRole('button', { name: '비밀번호 변경' }).click()
  await expect(page.getByText('비밀번호를 바꿨어요')).toBeVisible()

  await page.getByRole('button', { name: '복구 코드 새로 만들기' }).click()
  await page.getByLabel('비밀번호', { exact: true }).fill('second2')
  await page.getByRole('button', { name: '새 복구 코드 만들기' }).click()
  await expect(page.getByText('예전 복구 코드는 이제 쓸 수 없어요')).toBeVisible()
  const newCode = (await page.getByLabel('복구 코드').textContent())!.trim()
  expect(newCode).not.toBe(oldCode)
  await page.getByLabel('안전한 곳에 적어 뒀어요').check()
  await page.getByRole('button', { name: '확인' }).click()
  await page.getByRole('button', { name: '지금 잠그기' }).click()
  await page.getByRole('button', { name: '비밀번호를 잊었어요' }).click()
  await page.getByRole('button', { name: /복구 코드로 열고/ }).click()
  await page.getByLabel('복구 코드 (24자리)').fill(oldCode)
  await page.getByRole('button', { name: '복구 코드로 열기' }).click()
  await expect(page.getByRole('alert')).toContainText('복구 코드가 맞지 않아요')
  await page.getByLabel('복구 코드 (24자리)').fill(newCode)
  await page.getByRole('button', { name: '복구 코드로 열기' }).click()
  await expect(page.getByLabel('새 비밀번호 (6자 이상)')).toBeVisible()
})

test('지문(테스트용 가짜 저장소): 웹 기본은 사용 불가 → 켜기(비밀번호 확인) → 잠금 화면에서 지문 창 자동 1회 · 취소하면 비밀번호 · 버튼으로 다시 · 지문으로 비밀번호 재설정 · 끄기', async ({ page }) => {
  onlyMobile()
  const fake = (pass: boolean) => page.evaluate((p) => (window as unknown as { __eyebodyFakeBiometric: (p: boolean) => void }).__eyebodyFakeBiometric(p), pass)
  await create(page)
  await page.getByRole('button', { name: '눈바디 설정' }).click()
  await expect(page.getByRole('switch', { name: '지문 잠금' })).toBeDisabled()
  await expect(page.getByText('갤럭시 앱에서만 쓸 수 있어요')).toBeVisible()
  await page.keyboard.press('Escape')
  // 가짜 지문 연결 후 켜기
  await fake(true)
  await page.getByRole('button', { name: '눈바디 설정' }).click()
  await page.getByRole('switch', { name: '지문 잠금' }).click()
  await page.getByLabel('비밀번호', { exact: true }).fill(PW)
  await page.getByRole('button', { name: '지문 잠금 켜기' }).click()
  await expect(page.getByText('지문 잠금을 켰어요')).toBeVisible()
  await expect(page.getByRole('switch', { name: '지문 잠금' })).toBeChecked()
  // 잠그면 지문 창이 자동으로 떠서 바로 열림
  await page.getByRole('button', { name: '지금 잠그기' }).click()
  await expect(page.getByRole('tablist', { name: '눈바디 화면' })).toBeVisible()
  // 지문 취소 → 자동은 한 번만, 비밀번호 칸이 남음
  await fake(false)
  await page.getByRole('button', { name: '눈바디 설정' }).click()
  await page.getByRole('button', { name: '지금 잠그기' }).click()
  await expect(page.getByRole('alert')).toContainText('지문 인증을 취소했어요')
  await expect(page.getByLabel('비밀번호 (6자 이상)')).toBeVisible()
  // 버튼으로 다시 시도
  await fake(true)
  await page.getByRole('button', { name: '지문으로 열기' }).click()
  await expect(page.getByRole('tablist', { name: '눈바디 화면' })).toBeVisible()
  // 지문으로 비밀번호 재설정
  await fake(false)
  await page.getByRole('button', { name: '눈바디 설정' }).click()
  await page.getByRole('button', { name: '지금 잠그기' }).click()
  await expect(page.getByRole('alert')).toContainText('지문 인증을 취소했어요')
  await fake(true)
  await page.getByRole('button', { name: '비밀번호를 잊었어요' }).click()
  await page.getByRole('button', { name: /지문으로 열고/ }).click()
  await page.getByLabel('새 비밀번호 (6자 이상)').fill('finger9')
  await page.getByLabel('새 비밀번호 확인').fill('finger9')
  await page.getByRole('button', { name: '새 비밀번호로 저장' }).click()
  await expect(page.getByText('새 비밀번호로 바꿨어요')).toBeVisible()
  // 끄면 자동 지문 창·버튼 없음, 새 비밀번호로 열림
  await page.getByRole('button', { name: '눈바디 설정' }).click()
  await page.getByRole('switch', { name: '지문 잠금' }).click()
  await expect(page.getByText('지문 잠금을 껐어요')).toBeVisible()
  await page.getByRole('button', { name: '지금 잠그기' }).click()
  await expect(page.getByText('눈바디 잠금 해제')).toBeVisible()
  await expect(page.getByRole('button', { name: '지문으로 열기' })).toHaveCount(0)
  await unlockPw(page, 'finger9')
  await expect(page.getByRole('tablist', { name: '눈바디 화면' })).toBeVisible()
})

test('자동 잠금: 앱이 백그라운드로 가면 바로 잠기고 사진이 화면에서 사라짐 · 5분 무입력 잠금', async ({ page }) => {
  onlyMobile()
  await page.clock.install()
  await create(page)
  await addFront(page)
  // 백그라운드 전환
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await expect(page.getByText('눈바디 잠금 해제')).toBeVisible()
  await expect(page.getByRole('img', { name: /눈바디$/ })).toHaveCount(0)
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await unlockPw(page, PW)
  await expect(page.getByRole('img', { name: /정면 눈바디$/ })).toBeVisible()
  // 5분 무입력
  await page.clock.fastForward('05:20')
  await expect(page.getByText('눈바디 잠금 해제')).toBeVisible()
})

test('이전 중단 후 이어하기: 예전 사진 2장 중 1장이 깨져서 멈춤 → 데이터 손실 없음 → 고친 뒤 다시 열면 마저 이전', async ({ page }) => {
  onlyMobile()
  await page.goto('/home')
  // 예전(v1) 금고 + 사진 2장. 두 번째는 암호문 1바이트를 망가뜨림 (원본은 보관)
  await page.evaluate(async (pw) => {
    const te = new TextEncoder()
    const salt = crypto.getRandomValues(new Uint8Array(16))
    const base = await crypto.subtle.importKey('raw', te.encode(pw), 'PBKDF2', false, ['deriveKey'])
    const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 310_000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
    const enc = async (data: BufferSource) => {
      const iv = crypto.getRandomValues(new Uint8Array(12))
      return { iv, data: await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data) }
    }
    const jpg = async (c: string) => {
      const cv = document.createElement('canvas')
      cv.width = 120
      cv.height = 160
      cv.getContext('2d')!.fillStyle = c
      cv.getContext('2d')!.fillRect(0, 0, 120, 160)
      return (await new Promise<Blob>((r) => cv.toBlob((b) => r(b!), 'image/jpeg'))).arrayBuffer()
    }
    const v = await enc(te.encode('slimlog-eyebody-ok'))
    const today = new Date()
    const k = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    const rows = []
    for (const [id, c] of [
      ['old-a', '#aa3333'],
      ['old-b', '#3333aa'],
    ]) {
      const j = await jpg(c)
      const a = await enc(j)
      const b = await enc(j)
      rows.push({ id, takenAt: k, createdAt: new Date().toISOString(), iv: a.iv, data: a.data, thumbIv: b.iv, thumb: b.data })
    }
    const good = rows[1].data.slice(0)
    const broken = new Uint8Array(rows[1].data.slice(0))
    broken[5] ^= 0xff
    rows[1].data = broken.buffer
    ;(window as unknown as { __goodB: ArrayBuffer }).__goodB = good
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open('slimlog-eyebody', 1)
      req.onupgradeneeded = () => {
        req.result.createObjectStore('meta')
        req.result.createObjectStore('photos', { keyPath: 'id' })
      }
      req.onsuccess = () => {
        const t = req.result.transaction(['meta', 'photos'], 'readwrite')
        t.objectStore('meta').put({ salt, iv: v.iv, check: v.data }, 'key')
        for (const r of rows) t.objectStore('photos').put(r)
        t.oncomplete = () => resolve()
        t.onerror = () => reject(t.error)
      }
    })
  }, PW)
  const state = () =>
    page.evaluate(
      () =>
        new Promise<{ rows: Record<string, number | undefined>; legacyMeta: boolean; migration?: string }>((resolve) => {
          const req = indexedDB.open('slimlog-eyebody')
          req.onsuccess = () => {
            const t = req.result.transaction(['meta', 'photos'])
            const all = t.objectStore('photos').getAll()
            const k = t.objectStore('meta').get('key')
            const v2 = t.objectStore('meta').get('v2')
            t.oncomplete = () => resolve({ rows: Object.fromEntries(all.result.map((r: { id: string; v?: number }) => [r.id, r.v])), legacyMeta: !!k.result, migration: v2.result?.migration })
          }
        }),
    )

  // 앱 안에서 이동 (window.__goodB 유지)
  await page.evaluate(() => {
    history.pushState({}, '', '/record/eyebody')
    dispatchEvent(new PopStateEvent('popstate'))
  })
  await unlockPw(page, PW)
  await expect(page.getByRole('alert')).toContainText('예전 사진 하나를 옮기지 못했어요 (1/2장 옮김)') // 두 번째 사진에서 멈춤
  let s = await state()
  expect(s).toEqual({ rows: { 'old-a': 2, 'old-b': undefined }, legacyMeta: true, migration: 'pending' }) // 1장 옮김, 1장은 예전 그대로, 예전 확인값 보존

  // 깨진 바이트를 원래대로 되돌린 뒤(= 일시적 오류가 풀린 상황) 다시 열기 → 이어서 마저 옮김
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const req = indexedDB.open('slimlog-eyebody')
        req.onsuccess = () => {
          const t = req.result.transaction('photos', 'readwrite')
          const st = t.objectStore('photos')
          const g = st.get('old-b')
          g.onsuccess = () => st.put({ ...g.result, data: (window as unknown as { __goodB: ArrayBuffer }).__goodB })
          t.oncomplete = () => resolve()
        }
      }),
  )
  await expect(page.getByText('눈바디 잠금 해제')).toBeVisible() // 멈추면 잠긴 상태로 남음
  await unlockPw(page, PW)
  await expect(page.getByRole('tablist', { name: '눈바디 화면' })).toBeVisible()
  s = await state()
  expect(s).toEqual({ rows: { 'old-a': 2, 'old-b': 2 }, legacyMeta: false, migration: 'done' })
  // 두 장 다 열림 (같은 날 정면 2장 → 대표 1장 + 예전 사진 1장)
  await expect(page.getByRole('img', { name: /정면 눈바디$/ })).toBeVisible()
  await expect(page.getByRole('list', { name: '같은 각도 예전 사진' }).getByRole('img')).toHaveCount(1)
})
