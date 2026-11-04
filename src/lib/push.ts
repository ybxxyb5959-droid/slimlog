import { isNativeApp } from './native'
import { api, apiReady } from '@/lib/api'
import { isLive, sb } from '@/lib/supabase'

/**
 * 폰 푸시(웹 푸시) 등록
 * - 서비스 워커(public/sw.js) 등록 → 알림 권한 → 푸시 구독 → push_subscriptions 저장(RLS: 본인)
 * - 아이폰은 '홈 화면에 추가'한 앱에서만 웹 푸시를 받을 수 있다
 * - 실패해도 알림 시간은 저장되고, 앱을 열면 '지금 먹을 시간'으로 보여준다
 */
export type PushResult = 'subscribed' | 'unsupported' | 'ios-install' | 'denied' | 'no-server' | 'mock' | 'error'

const b64ToBytes = (b64: string) => {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4)
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

export async function enablePush(): Promise<PushResult> {
  if (!isLive) return 'mock'
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent)
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return ios && !standalone ? 'ios-install' : 'unsupported'
  if (!apiReady) return 'no-server'
  try {
    const perm = await Notification.requestPermission()
    if (perm !== 'granted') return 'denied'
    const { publicKey } = await api<{ publicKey: string }>('/push/public-key')
    const reg = await navigator.serviceWorker.register('/sw.js')
    await navigator.serviceWorker.ready
    const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(publicKey) as BufferSource }))
    const j = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } }
    const r = await sb().from('push_subscriptions').upsert({ endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth, user_agent: navigator.userAgent.slice(0, 200) }, { onConflict: 'endpoint', ignoreDuplicates: true })
    if (r.error) throw r.error
    return 'subscribed'
  } catch {
    return 'error'
  }
}

export function pushHint(r: PushResult): string | undefined {
  switch (r) {
    case 'mock':
      return '목업 · 실제 알림은 보내지 않아요.'
    case 'ios-install':
      return '아이폰은 Safari 공유 버튼 → 홈 화면에 추가한 앱에서 알림을 켤 수 있어요.'
    case 'unsupported':
      // 갤럭시 앱(웹뷰)은 웹 푸시를 지원하지 않음 → 안드로이드 푸시(FCM)는 다음 단계
      return isNativeApp() ? '갤럭시 앱 알림은 다음 업데이트에서 지원해요. 앱을 열면 먹을 시간을 알려드려요.' : '이 브라우저는 폰 알림을 지원하지 않아요. 앱을 열면 먹을 시간을 알려드려요.'
    case 'denied':
      return '알림 권한이 꺼져 있어요. 브라우저 설정에서 허용하면 폰으로 알려드려요.'
    case 'no-server':
      return '폰 알림은 서버 연결 후 시작돼요. 앱을 열면 먹을 시간을 알려드려요.'
    case 'error':
      return '폰 알림을 켜지 못했어요. 앱을 열면 먹을 시간을 알려드려요.'
    default:
      return undefined
  }
}
