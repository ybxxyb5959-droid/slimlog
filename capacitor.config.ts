import type { CapacitorConfig } from '@capacitor/cli'

/**
 * 갤럭시 전용 Android 앱 (Capacitor). 웹 프로젝트(dist)를 그대로 감싼다.
 * 빌드 순서: docs/안드로이드_빌드_가이드.md
 */
const config: CapacitorConfig = {
  appId: 'com.slimlog.app',
  appName: 'SlimLog',
  webDir: 'dist',
  android: {
    // https://localhost 로 열림 (WebCrypto·IndexedDB·Service Worker 는 보안 출처에서만 동작)
    allowMixedContent: false,
    // 출시 빌드에서는 크롬 원격 디버깅을 끈다 (디버그 빌드는 Capacitor 가 알아서 켬)
    webContentsDebuggingEnabled: false,
  },
  server: {
    androidScheme: 'https',
  },
}

export default config
