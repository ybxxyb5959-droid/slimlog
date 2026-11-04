import { AccessControl, BiometricAuthError, NativeBiometric } from '@capgo/capacitor-native-biometric'

import { setBiometricProvider } from './biometric'

/**
 * 갤럭시 앱용 지문 저장소 — @capgo/capacitor-native-biometric 8.9.1 (+ patches/ 의 무효화 옵션 강제 패치)
 * - store: setData(accessControl=BIOMETRY_CURRENT_SET, authValidityDuration=0)
 *   → Keystore RSA 열쇠: setUserAuthenticationRequired(true), AUTH_BIOMETRIC_STRONG 매번 인증,
 *     setInvalidatedByBiometricEnrollment(true). 저장은 공개키로 감싸서 지문 없이 가능
 * - load: getSecureData → BiometricPrompt(BIOMETRIC_STRONG 만) + CryptoObject 로 인증된 열쇠로만 풀림
 * 검증 기록: docs/눈바디_잠금_설계.md
 */
const msg = (e: unknown): string => {
  const code = Number((e as { code?: string | number })?.code)
  switch (code) {
    case BiometricAuthError.USER_CANCEL:
    case BiometricAuthError.APP_CANCEL:
    case BiometricAuthError.SYSTEM_CANCEL:
    case BiometricAuthError.USER_FALLBACK:
      return '지문 인증을 취소했어요.'
    case BiometricAuthError.USER_LOCKOUT:
    case BiometricAuthError.USER_TEMPORARY_LOCKOUT:
      return '지문을 여러 번 틀려서 잠시 쓸 수 없어요. 비밀번호로 열어 주세요.'
    case BiometricAuthError.BIOMETRICS_NOT_ENROLLED:
      return '휴대폰에 등록된 지문이 없어요. 설정에서 지문을 먼저 등록해 주세요.'
    case BiometricAuthError.NO_PROTECTED_CREDENTIALS_FOUND:
      return '지문 열쇠가 없어요. 비밀번호로 연 뒤 지문 잠금을 다시 켜 주세요.'
    case BiometricAuthError.AUTHENTICATION_FAILED:
      return '지문이 맞지 않아요.'
    default:
      // 지문을 새로 등록하면 Keystore 열쇠가 무효가 되어 여기로 온다
      return '지문 열쇠를 쓸 수 없어요. 휴대폰에 지문을 새로 등록했다면 비밀번호로 연 뒤 지문 잠금을 다시 켜 주세요.'
  }
}

export function registerNativeBiometric() {
  setBiometricProvider({
    available: async () => {
      try {
        const r = await NativeBiometric.isAvailable({ useFallback: false })
        if (r.strongBiometryIsAvailable) return { ok: true }
        if (r.errorCode === BiometricAuthError.BIOMETRICS_NOT_ENROLLED) return { ok: false, reason: '휴대폰 설정에서 지문을 먼저 등록해 주세요.' }
        return { ok: false, reason: '이 휴대폰에서는 지문 잠금을 쓸 수 없어요.' }
      } catch {
        return { ok: false, reason: '이 휴대폰에서는 지문 잠금을 쓸 수 없어요.' }
      }
    },
    store: async (key, secret) => {
      try {
        await NativeBiometric.setData({ key, value: secret, accessControl: AccessControl.BIOMETRY_CURRENT_SET, authValidityDuration: 0 })
      } catch (e) {
        throw new Error('지문 잠금을 켜지 못했어요. 이 휴대폰이 지문 재등록 감지를 지원하지 않을 수 있어요.', { cause: e })
      }
    },
    load: async (key) => {
      try {
        const r = await NativeBiometric.getSecureData({ key, title: '눈바디 잠금 해제', subtitle: '등록한 지문으로 열어요', negativeButtonText: '비밀번호로 열기' })
        return r.value
      } catch (e) {
        throw new Error(msg(e), { cause: e })
      }
    },
    remove: async (key) => {
      await NativeBiometric.deleteData({ key }).catch(() => {})
    },
  })
}
