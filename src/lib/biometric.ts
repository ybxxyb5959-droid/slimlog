/**
 * 지문(Android 생체인증) 보호 저장소 연결부.
 * - 웹: 지원 안 함 → 눈바디는 비밀번호·복구 코드로만 열린다
 * - Capacitor Android 앱: @capgo/capacitor-native-biometric 의 setData/getSecureData 를
 *   accessControl=BIOMETRY_CURRENT_SET, authValidityDuration=0 으로 쓴다 (docs/눈바디_잠금_설계.md 2절)
 *   → Keystore 열쇠가 '지문 인증한 그 순간'에만 풀리고, 지문을 새로 등록하면 무효가 된다
 * 앱 쪽 연결은 src/lib/biometric.native.ts 에서 setBiometricProvider 로 등록한다 (4·5단계)
 */
export interface BiometricProvider {
  available(): Promise<{ ok: boolean; reason?: string }>
  /** 지문 인증 없이 저장 가능(공개키로 감쌈), 읽을 때만 인증 */
  store(key: string, secret: string): Promise<void>
  /** 지문 창을 띄우고, 인증되면 값을 돌려준다 */
  load(key: string): Promise<string>
  remove(key: string): Promise<void>
}

const unsupported: BiometricProvider = {
  available: async () => ({ ok: false, reason: '지문 잠금은 갤럭시 앱에서만 쓸 수 있어요.' }),
  store: async () => {
    throw new Error('지문 잠금은 갤럭시 앱에서만 쓸 수 있어요.')
  },
  load: async () => {
    throw new Error('지문 잠금은 갤럭시 앱에서만 쓸 수 있어요.')
  },
  remove: async () => {},
}

let provider: BiometricProvider = unsupported
export const setBiometricProvider = (p: BiometricProvider) => (provider = p)

export const biometric: BiometricProvider = {
  available: () => provider.available(),
  store: (k, s) => provider.store(k, s),
  load: (k) => provider.load(k),
  remove: (k) => provider.remove(k),
}

/**
 * E2E 전용: 테스트 빌드(VITE_E2E_HOOKS=1)에서만 메모리 가짜 지문을 켤 수 있다.
 * 값은 메모리에만(새로고침하면 사라짐) — 실제 배포 빌드에는 이 코드가 포함되지 않는다.
 */
if (import.meta.env.VITE_E2E_HOOKS === '1' && typeof window !== 'undefined') {
  const mem = new Map<string, string>()
  ;(window as unknown as { __eyebodyFakeBiometric: (pass: boolean) => void }).__eyebodyFakeBiometric = (pass: boolean) =>
    setBiometricProvider({
      available: async () => ({ ok: true }),
      store: async (k, s) => void mem.set(k, s),
      load: async (k) => {
        if (!pass) throw new Error('지문 인증을 취소했어요.')
        const v = mem.get(k)
        if (!v) throw new Error('지문 열쇠가 없어요. 비밀번호로 연 뒤 지문 잠금을 다시 켜 주세요.')
        return v
      },
      remove: async (k) => void mem.delete(k),
    })
}
