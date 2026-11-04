import { expect, type Page } from '@playwright/test'

/** 테스트마다 새 이메일 (같은 DB 를 쓰므로 서로 섞이지 않게) */
export const uniqueEmail = (tag: string) => `${tag}-${Date.now()}-${Math.floor(Math.random() * 1e4)}@slimlog.test`
export const PASSWORD = 'test-password-1'

export async function devLogin(page: Page, email: string, password = PASSWORD) {
  // 클라우드는 이메일 확인이 켜져 있어 앱 가입으로는 바로 로그인 불가 → 서버 권한으로 '확인된 계정'을 미리 만든다
  // (이미 있으면 422 로 무시. 로컬에서도 같은 방식으로 동작)
  const url = process.env.LIVE_SUPABASE_URL!
  const key = process.env.LIVE_SUPABASE_SERVICE_KEY!
  await fetch(`${url}/auth/v1/admin/users`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { full_name: '김테스트' } }),
  })
  await page.goto('/login')
  await page.getByLabel('개발용 이메일').fill(email)
  await page.getByLabel('개발용 비밀번호').fill(password)
  await page.getByRole('button', { name: '개발용 계정으로 로그인' }).click()
}

/** 가입 동의(필수 3개) → 온보딩 닉네임까지 */
export async function acceptRequiredConsents(page: Page) {
  await expect(page).toHaveURL('/consent')
  for (const name of ['필수 서비스 이용약관', '필수 개인정보 수집·이용', '필수 민감정보(건강정보) 처리']) {
    await page.getByRole('checkbox', { name }).click()
  }
  await page.getByRole('button', { name: '동의하고 시작하기' }).click()
  await expect(page).toHaveURL('/onboarding/nickname')
}

/** 닉네임 확정 → 신체정보 저장 → '나중에 기록' → 홈 */
export async function quickOnboarding(page: Page, opts: { nickname?: string; weight?: string; goal?: string } = {}) {
  if (opts.nickname) await page.getByLabel('나의 닉네임').fill(opts.nickname)
  await expect(page.getByText('사용할 수 있는 닉네임이에요.')).toBeVisible()
  await page.getByRole('button', { name: '이 닉네임으로 계속하기' }).click()
  await expect(page).toHaveURL('/onboarding/body')
  await page.getByLabel('현재 체중').fill(opts.weight ?? '80')
  await page.getByLabel('목표 체중').fill(opts.goal ?? '72')
  await page.getByRole('button', { name: '다음' }).click()
  await expect(page).toHaveURL('/onboarding/medication')
  await page.getByRole('radio', { name: /나중에 기록할게요/ }).click()
  await page.getByRole('button', { name: '슬림로그 시작하기' }).click()
  await expect(page).toHaveURL('/home')
}

/** 서버(service_role)로 직접 조회 — 화면이 아니라 DB 에 정말 저장됐는지 확인 */
export async function adminSelect(table: string, query: string) {
  const url = process.env.LIVE_SUPABASE_URL!
  const key = process.env.LIVE_SUPABASE_SERVICE_KEY!
  const res = await fetch(`${url}/rest/v1/${table}?${query}`, { headers: { apikey: key, Authorization: `Bearer ${key}` } })
  return (await res.json()) as Record<string, unknown>[]
}

export async function userIdOf(email: string) {
  const url = process.env.LIVE_SUPABASE_URL!
  const key = process.env.LIVE_SUPABASE_SERVICE_KEY!
  const res = await fetch(`${url}/auth/v1/admin/users?per_page=200`, { headers: { apikey: key, Authorization: `Bearer ${key}` } })
  const json = (await res.json()) as { users: { id: string; email: string }[] }
  return json.users.find((u) => u.email === email)?.id ?? null
}

/** 서버(service_role)로 행 넣기/지우기 — 공용 음식처럼 앱이 직접 못 넣는 데이터 준비용 */
export async function adminInsert(table: string, row: Record<string, unknown>) {
  const url = process.env.LIVE_SUPABASE_URL!
  const key = process.env.LIVE_SUPABASE_SERVICE_KEY!
  const res = await fetch(`${url}/rest/v1/${table}`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify(row),
  })
  if (!res.ok) throw new Error(`${table} insert ${res.status} ${await res.text()}`)
}
export async function adminDelete(table: string, query: string) {
  const url = process.env.LIVE_SUPABASE_URL!
  const key = process.env.LIVE_SUPABASE_SERVICE_KEY!
  await fetch(`${url}/rest/v1/${table}?${query}`, { method: 'DELETE', headers: { apikey: key, Authorization: `Bearer ${key}` } })
}

export async function adminPatch(table: string, query: string, patch: Record<string, unknown>) {
  const url = process.env.LIVE_SUPABASE_URL!
  const key = process.env.LIVE_SUPABASE_SERVICE_KEY!
  const res = await fetch(`${url}/rest/v1/${table}?${query}`, { method: 'PATCH', headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify(patch) })
  if (!res.ok) throw new Error(`${table} patch ${res.status}`)
}
