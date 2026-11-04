/**
 * 테스트가 끝나면 테스트 계정(@slimlog.test)과 그 사진 파일을 모두 지운다.
 * 클라우드(실서비스 DB)에서 돌릴 때 흔적을 남기지 않기 위함. 다른 이메일은 절대 건드리지 않는다.
 */
export default async function teardown() {
  const url = process.env.LIVE_SUPABASE_URL
  const key = process.env.LIVE_SUPABASE_SERVICE_KEY
  if (!url || !key) return
  const h = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }
  const targets: { id: string; email: string }[] = []
  for (let page = 1; page < 50; page++) {
    const res = await fetch(`${url}/auth/v1/admin/users?per_page=200&page=${page}`, { headers: h })
    const users = ((await res.json()) as { users?: { id: string; email?: string }[] }).users ?? []
    for (const u of users) if (u.email?.endsWith('@slimlog.test')) targets.push({ id: u.id, email: u.email })
    if (users.length < 200) break
  }
  for (const t of targets) {
    // 사진: meal-photos/<user_id>/... (서버 API 와 같은 순서: 파일 → 사용자)
    const list = await fetch(`${url}/storage/v1/object/list/meal-photos`, { method: 'POST', headers: h, body: JSON.stringify({ prefix: t.id, limit: 1000 }) })
    const files = ((await list.json().catch(() => [])) as { name: string }[]) ?? []
    if (Array.isArray(files) && files.length)
      await fetch(`${url}/storage/v1/object/meal-photos`, { method: 'DELETE', headers: h, body: JSON.stringify({ prefixes: files.map((f) => `${t.id}/${f.name}`) }) })
    await fetch(`${url}/auth/v1/admin/users/${t.id}`, { method: 'DELETE', headers: h })
  }
  console.log(`[teardown] 테스트 계정 ${targets.length}개 정리`)
}
