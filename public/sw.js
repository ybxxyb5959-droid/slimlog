/* SlimLog 서비스 워커 — 폰 푸시 알림 (영양제·복용약 먹을 시간)
 * 서버가 보내는 내용: { title, body, url, api, token }
 * 알림 버튼: [먹었어요] [건너뛰었어요] → 서버에 기록 (token 은 서버가 서명한 1일짜리 값, 로그인 토큰 아님)
 */
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { title: 'SlimLog', body: event.data ? event.data.text() : '' }
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'SlimLog', {
      body: data.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/favicon-32.png',
      tag: data.token || 'slimlog',
      data,
      actions: data.token
        ? [
            { action: 'taken', title: '먹었어요' },
            { action: 'skipped', title: '건너뛰었어요' },
          ]
        : [],
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  const data = event.notification.data || {}
  event.notification.close()
  if ((event.action === 'taken' || event.action === 'skipped') && data.api && data.token) {
    event.waitUntil(
      fetch(`${data.api}/push/action`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: data.token, action: event.action }) }).catch(() => {}),
    )
    return
  }
  const url = data.url || '/record/daily'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) if ('focus' in c) return c.navigate(url).then((w) => (w || c).focus())
      return self.clients.openWindow(url)
    }),
  )
})
