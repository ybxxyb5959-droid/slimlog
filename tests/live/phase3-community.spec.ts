import { expect, test } from '@playwright/test'

import { acceptRequiredConsents, adminPatch, adminSelect, devLogin, quickOnboarding, uniqueEmail, userIdOf } from './helpers'

/** Phase 3 — 커뮤니티 (서버 금칙어 검사·좋아요·댓글·신고·관리자 조치) */

async function writePost(page: import('@playwright/test').Page, title: string, body: string) {
  await page.goto('/community/write')
  await page.getByRole('radio', { name: '자유' }).click()
  await page.getByLabel('제목').fill(title)
  await page.getByLabel('내용').fill(body)
  await page.getByRole('button', { name: '게시하기' }).click()
}

test('글쓰기(서버 검사) → 다른 사람 좋아요·댓글·신고 → 관리자 신고 글 숨김', async ({ page, browser }) => {
  const emailA = uniqueEmail('p3-c-a')
  await devLogin(page, emailA)
  await acceptRequiredConsents(page)
  const nickA = `작성${Date.now() % 100000}`
  await quickOnboarding(page, { nickname: nickA })
  const uidA = (await userIdOf(emailA))!

  // LOW → 공개
  const title = `E2E 6주차 후기 ${Date.now() % 10000}`
  await writePost(page, title, '단백질 챙기면서 기록하고 있어요. 다들 화이팅!')
  await expect(page.getByText('게시됐어요')).toBeVisible()
  await expect(page.getByRole('heading', { name: title })).toBeVisible()
  // 용량 질문도 관리자 검토 없이 바로 공개
  const reviewTitle = `E2E 증량 ${Date.now() % 10000}`
  await writePost(page, reviewTitle, '몇 mg부터 올리세요? 경험 알려 주세요')
  await expect.poll(async () => (await adminSelect('posts', `user_id=eq.${uidA}&select=status&order=created_at`)).map((p) => p.status)).toEqual(['visible', 'visible'])
  const posts = await adminSelect('posts', `user_id=eq.${uidA}&select=post_id,title,status&order=created_at`)

  // B: 공개 글만 보임 → 좋아요·댓글·신고
  const ctx = await browser.newContext()
  const b = await ctx.newPage()
  await devLogin(b, uniqueEmail('p3-c-b'))
  await acceptRequiredConsents(b)
  await quickOnboarding(b)
  await b.goto('/community')
  await expect(b.getByText(title)).toBeVisible()
  await expect(b.getByText(reviewTitle)).toBeVisible()
  await b.getByText(title).click()
  await expect(b.getByRole('heading', { name: title })).toBeVisible()
  await expect(b.getByText(nickA).first()).toBeVisible()
  await b.getByRole('button', { name: /좋아요/ }).click()
  await expect.poll(async () => (await adminSelect('posts', `post_id=eq.${posts[0].post_id}&select=like_count`))[0].like_count).toBe(1)
  await b.getByLabel('댓글').fill('응원해요!')
  await b.getByRole('button', { name: '등록' }).click()
  await expect.poll(async () => (await adminSelect('comments', `post_id=eq.${posts[0].post_id}&select=body`)).map((c) => c.body)).toEqual(['응원해요!'])
  await b.getByRole('button', { name: '신고' }).click()
  await b.getByRole('radio', { name: '광고·홍보' }).click()
  await b.getByRole('button', { name: '신고 접수' }).click()
  await expect(b.getByText('신고가 접수됐어요')).toBeVisible()
  expect(await adminSelect('reports', `target_id=eq.${posts[0].post_id}&select=reason,status`)).toEqual([{ reason: 'ad', status: 'open' }])

  // BLOCKED → 서버도 거절, 저장 안 됨
  await writePost(b, '펜 정리', '남은 펜 양 도해요 쪽지 주세요')
  await expect(b).toHaveURL('/community/write')
  await ctx.close()

  // 관리자: DB 에서 권한 부여 → 신고된 글 숨김
  await adminPatch('users', `user_id=eq.${uidA}`, { role: 'admin' })
  await page.reload()
  await page.goto('/admin/moderation')
  await expect(page.getByRole('option', { name: new RegExp(title) })).toBeVisible()
  await page.getByRole('option', { name: new RegExp(title) }).click()
  await page.getByRole('radio', { name: '숨김' }).click()
  await page.getByLabel('사유 (필수)').fill('광고 신고 확인')
  await page.getByRole('button', { name: '조치 저장' }).click()
  await expect(page.getByText('숨김 처리했어요')).toBeVisible()
  await expect.poll(async () => (await adminSelect('posts', `post_id=eq.${posts[0].post_id}&select=status`))[0].status).toBe('blocked')
  const acts = await adminSelect('admin_actions', `admin_id=eq.${uidA}&select=action,reason`)
  expect(acts).toContainEqual({ action: 'hide', reason: '광고 신고 확인' })
})

test('관리자가 아니면 검토 화면 접근 불가', async ({ page }) => {
  await devLogin(page, uniqueEmail('p3-c-nonadmin'))
  await acceptRequiredConsents(page)
  await quickOnboarding(page)
  await page.goto('/admin/moderation')
  await expect(page.getByText('관리자만 볼 수 있어요')).toBeVisible()
})
