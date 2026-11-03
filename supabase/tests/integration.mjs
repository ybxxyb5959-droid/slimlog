// SlimLog Auth · Storage · REST 통합 테스트 (실제 Supabase HTTP API 사용, 추가 설치 없음)
// 실행:
//   SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_ANON_KEY=... SUPABASE_SERVICE_ROLE_KEY=... node supabase/tests/integration.mjs
// 테스트용 사용자 2명과 파일을 만들고, 끝나면 모두 지운다.
// 카카오·구글 로그인은 자동화할 수 없으므로 이메일 테스트 계정으로 같은 Auth 흐름(JWT·RLS)을 확인한다.

const URL_ = process.env.SUPABASE_URL
const ANON = process.env.SUPABASE_ANON_KEY
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL_ || !ANON || !SERVICE) {
  console.error('SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY 가 필요해요')
  process.exit(2)
}

let pass = 0
let fail = 0
const ok = (name, cond, extra = '') => {
  cond ? pass++ : fail++
  console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ` [${extra}]` : ''}`)
}

const req = async (path, { token, key = ANON, method = 'GET', body, headers = {}, raw } = {}) => {
  const h = { apikey: key, Authorization: `Bearer ${token ?? key}`, ...headers }
  let payload = body
  if (body !== undefined && !raw) {
    h['Content-Type'] = 'application/json'
    payload = JSON.stringify(body)
  }
  const res = await fetch(URL_ + path, { method, headers: h, body: payload })
  const text = await res.text()
  let json = null
  try { json = text ? JSON.parse(text) : null } catch { /* 텍스트 응답 */ }
  return { status: res.status, json, text }
}
const svc = (path, opts = {}) => req(path, { ...opts, key: SERVICE, token: SERVICE })
const rest = (path, token, opts = {}) => req(`/rest/v1/${path}`, { ...opts, token, headers: { Prefer: 'return=representation', ...(opts.headers ?? {}) } })

const stamp = Date.now()
const users = {}
const createdObjects = []
const BUCKET = 'meal-photos'
// JPEG 시작 바이트를 가진 작은 테스트 파일 (실제 사진 아님)
const fakeJpeg = (n = 2048) => { const b = Buffer.alloc(n, 0); b[0] = 0xff; b[1] = 0xd8; b[n - 2] = 0xff; b[n - 1] = 0xd9; return b }

async function main() {
  // ── Auth
  for (const k of ['a', 'b']) {
    const email = `it-${k}-${stamp}@test.local`
    const password = `Test-${stamp}-pw!`
    const c = await svc('/auth/v1/admin/users', { method: 'POST', body: { email, password, email_confirm: true } })
    const s = await req('/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password } })
    users[k] = { id: c.json?.id, token: s.json?.access_token }
  }
  ok('A01 테스트 사용자 생성·로그인(JWT 발급)', !!users.a.token && !!users.b.token)
  const me = await req('/auth/v1/user', { token: users.a.token })
  ok('A02 JWT 로 사용자 확인 (FastAPI 가 같은 방식으로 검증)', me.json?.id === users.a.id)
  const bad = await req('/auth/v1/user', { token: users.a.token.slice(0, -4) + 'abcd' })
  ok('A03 변조된 JWT 거부', bad.status === 401 || bad.status === 403, String(bad.status))

  const prof = await rest(`users?select=user_id,nickname,role&user_id=eq.${users.a.id}`, users.a.token)
  ok('A04 가입 트리거로 프로필 생성', prof.json?.length === 1 && prof.json[0].role === 'user')
  const nick = await rest(`users?user_id=eq.${users.a.id}`, users.a.token, { method: 'PATCH', body: { nickname: `테스트${stamp % 10000}` } })
  ok('A05 닉네임 저장', nick.status === 200 && nick.json?.length === 1, String(nick.status))
  const esc = await rest(`users?user_id=eq.${users.a.id}`, users.a.token, { method: 'PATCH', body: { role: 'admin' } })
  ok('A06 관리자 권한 상승 차단', esc.status >= 400, String(esc.status))
  const anonUsers = await req('/rest/v1/users?select=nickname')
  ok('A07 로그인 전에는 프로필 조회 불가', anonUsers.status >= 400 || (Array.isArray(anonUsers.json) && anonUsers.json.length === 0), String(anonUsers.status))

  // ── 민감정보 동의
  const med = await svc('/rest/v1/medications', { method: 'POST', body: { med_id: `it-med-${stamp}`, name: '테스트약', ingredient: 'test', half_life_h: 120 } })
  ok('A08 서버가 약 기준 정보 등록', med.status === 201, String(med.status))
  const dose = { med_id: `it-med-${stamp}`, dose_mg: 2.5, injected_at: new Date().toISOString() }
  const d0 = await rest('doses', users.a.token, { method: 'POST', body: dose })
  ok('A09 동의 전 투약 저장 차단', d0.status >= 400, String(d0.status))
  await rest('consents', users.a.token, { method: 'POST', body: { user_id: users.a.id, type: 'sensitive', version: 'v1' } })
  const d1 = await rest('doses', users.a.token, { method: 'POST', body: dose })
  ok('A10 동의 후 투약 저장', d1.status === 201, String(d1.status))
  const bDoses = await rest('doses?select=dose_id', users.b.token)
  ok('A11 B 는 A 투약 못 봄', Array.isArray(bDoses.json) && bDoses.json.length === 0)
  const post = await rest('posts', users.a.token, { method: 'POST', body: { user_id: users.a.id, title: 't', body: 'b', risk_level: 'LOW' } })
  ok('A12 앱에서 게시글 직접 작성 차단 (서버 전용)', post.status >= 400, String(post.status))

  // ── Storage
  const pathA = `${users.a.id}/${crypto.randomUUID()}.jpg`
  const upA = await req(`/storage/v1/object/${BUCKET}/${pathA}`, { token: users.a.token, method: 'POST', body: fakeJpeg(), raw: true, headers: { 'Content-Type': 'image/jpeg' } })
  ok('S01 앱이 직접 업로드 차단 (서버가 EXIF 제거 후 업로드)', upA.status >= 400 && /security|unauthorized/i.test(upA.text), `${upA.status} ${upA.json?.message ?? ''}`)
  const upS = await svc(`/storage/v1/object/${BUCKET}/${pathA}`, { method: 'POST', body: fakeJpeg(), raw: true, headers: { 'Content-Type': 'image/jpeg' } })
  if (upS.status === 200) createdObjects.push(pathA)
  ok('S02 서버(service_role) 업로드', upS.status === 200, String(upS.status))
  const pTxt = `${users.a.id}/${crypto.randomUUID()}.txt`
  const upTxt = await svc(`/storage/v1/object/${BUCKET}/${pTxt}`, { method: 'POST', body: Buffer.from('hello'), raw: true, headers: { 'Content-Type': 'text/plain' } })
  if (upTxt.status === 200) createdObjects.push(pTxt)
  ok('S03 이미지 아닌 파일 거부 (jpeg·webp 만)', upTxt.status >= 400, `${upTxt.status} ${upTxt.json?.message ?? ''}`)
  const pBig = `${users.a.id}/${crypto.randomUUID()}.jpg`
  const upBig = await svc(`/storage/v1/object/${BUCKET}/${pBig}`, { method: 'POST', body: fakeJpeg(5 * 1024 * 1024 + 10), raw: true, headers: { 'Content-Type': 'image/jpeg' } })
  if (upBig.status === 200) createdObjects.push(pBig)
  ok('S04 5MB 초과 거부', upBig.status >= 400, `${upBig.status} ${upBig.json?.message ?? ''}`)

  const signA = await req(`/storage/v1/object/sign/${BUCKET}/${pathA}`, { token: users.a.token, method: 'POST', body: { expiresIn: 600 } })
  ok('S05 본인 사진 서명 URL 발급', signA.status === 200 && !!signA.json?.signedURL, String(signA.status))
  if (signA.json?.signedURL) {
    const img = await fetch(`${URL_}/storage/v1${signA.json.signedURL}`)
    ok('S06 서명 URL 로 사진 열기', img.status === 200, String(img.status))
  }
  const signB = await req(`/storage/v1/object/sign/${BUCKET}/${pathA}`, { token: users.b.token, method: 'POST', body: { expiresIn: 600 } })
  ok('S07 B 는 A 사진 서명 URL 못 받음', signB.status >= 400, `${signB.status} ${signB.json?.message ?? ''}`)
  const pub = await fetch(`${URL_}/storage/v1/object/public/${BUCKET}/${pathA}`)
  ok('S08 공개 URL 로 접근 불가 (비공개 버킷)', pub.status >= 400, String(pub.status))
  const anonGet = await req(`/storage/v1/object/authenticated/${BUCKET}/${pathA}`)
  ok('S09 로그인 전 다운로드 불가', anonGet.status >= 400, String(anonGet.status))
  const listB = await req(`/storage/v1/object/list/${BUCKET}`, { token: users.b.token, method: 'POST', body: { prefix: `${users.a.id}/` } })
  ok('S10 B 는 A 폴더 목록 못 봄', Array.isArray(listB.json) && listB.json.length === 0, String(listB.status))
  await req(`/storage/v1/object/${BUCKET}/${pathA}`, { token: users.a.token, method: 'DELETE' })
  const still = await svc(`/storage/v1/object/info/authenticated/${BUCKET}/${pathA}`)
  ok('S11 앱이 사진 직접 삭제 불가 (서버 API 가 지움)', still.status === 200, String(still.status))

  // ── 사진 기록 = 경로·메타데이터만 DB 에
  const mealId = crypto.randomUUID()
  const meal = await svc('/rest/v1/meals', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: { meal_id: mealId, user_id: users.a.id, meal_type: 'lunch', eaten_at: new Date().toISOString(), source: 'photo', photo_path: pathA, photo_mime: 'image/jpeg', photo_bytes: 2048, photo_width: 1, photo_height: 1, photo_exif_stripped: true },
  })
  ok('S12 서버가 사진 기록(경로·메타) 저장', meal.status === 201, String(meal.status))
  const mA = await rest(`meals?select=photo_path,photo_mime,photo_bytes&meal_id=eq.${mealId}`, users.a.token)
  ok('S13 A 는 사진 메타데이터 조회', mA.json?.[0]?.photo_path === pathA)
  const mB = await rest(`meals?select=meal_id&meal_id=eq.${mealId}`, users.b.token)
  ok('S14 B 는 A 사진 기록 못 봄', Array.isArray(mB.json) && mB.json.length === 0)
  const delMeal = await rest(`meals?meal_id=eq.${mealId}`, users.a.token, { method: 'DELETE' })
  ok('S15 앱이 사진 기록 직접 삭제 불가', Array.isArray(delMeal.json) && delMeal.json.length === 0, String(delMeal.status))

  // ── 동의 철회 RPC
  const w = await rest('rpc/withdraw_sensitive_consent', users.a.token, { method: 'POST', body: {} })
  const after = await rest('doses?select=dose_id', users.a.token)
  ok('S16 동의 철회 → 투약 삭제, 결과 건수 반환', w.status === 200 && w.json?.doses === 1 && after.json?.length === 0, String(w.status))
  const mealAfter = await rest(`meals?select=meal_id&meal_id=eq.${mealId}`, users.a.token)
  ok('S17 동의 철회 → 식단 사진 기록 유지', mealAfter.json?.length === 1)
}

async function cleanup() {
  // 서버 API 의 삭제 순서와 같게: Storage 파일 → DB 행 → 사용자
  if (createdObjects.length) await svc(`/storage/v1/object/${BUCKET}`, { method: 'DELETE', body: { prefixes: createdObjects } })
  await svc(`/rest/v1/medications?med_id=eq.it-med-${stamp}`, { method: 'DELETE' }).catch(() => {})
  for (const u of Object.values(users)) if (u.id) await svc(`/auth/v1/admin/users/${u.id}`, { method: 'DELETE' })
  const left = await svc(`/rest/v1/users?select=user_id&user_id=in.(${Object.values(users).map((u) => u.id).join(',')})`)
  ok('Z01 정리: 테스트 사용자·데이터 삭제', Array.isArray(left.json) && left.json.length === 0)
}

try {
  await main()
} catch (e) {
  fail++
  console.log('FAIL 예외', e)
} finally {
  // 약 기준 정보는 투약 기록이 지워진 뒤에 삭제 가능 → 사용자 삭제 후 한 번 더
  await cleanup()
  await svc(`/rest/v1/medications?med_id=eq.it-med-${stamp}`, { method: 'DELETE' })
  console.log(`\nPASS ${pass} · FAIL ${fail}`)
  process.exit(fail ? 1 : 0)
}
