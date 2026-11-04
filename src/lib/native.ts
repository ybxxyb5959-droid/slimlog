import { Capacitor, registerPlugin } from '@capacitor/core'

/** 갤럭시 앱(Capacitor Android) 안에서 실행 중인지 */
export const isNativeApp = () => Capacitor.isNativePlatform()

/** android/app/src/main/java/com/slimlog/app/SecureScreenPlugin.java */
interface SecureScreenPlugin {
  setSecure(o: { enabled: boolean }): Promise<{ enabled: boolean }>
  clearCaptureFiles(): Promise<{ deleted: number }>
}
const SecureScreen = registerPlugin<SecureScreenPlugin>('SecureScreen')

/** 눈바디 화면에서만 FLAG_SECURE (최근 앱 미리보기·스크린샷 차단). 웹에서는 아무 일 안 함 */
export async function setSecureScreen(enabled: boolean) {
  if (!isNativeApp()) return
  await SecureScreen.setSecure({ enabled }).catch(() => {})
}

/** 사진 촬영 임시 파일(앱 전용 폴더의 평문 JPG) 지우기. 웹에서는 아무 일 안 함 */
export async function clearCaptureFiles() {
  if (!isNativeApp()) return
  await SecureScreen.clearCaptureFiles().catch(() => {})
}
