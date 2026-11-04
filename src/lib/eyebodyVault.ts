/**
 * 눈바디 사진 금고 v2 — 이 기기(IndexedDB)에만, 암호화해서 저장한다. 설계: docs/눈바디_잠금_설계.md
 *
 * 열쇠 구조 (데이터 열쇠와 비밀번호 분리)
 * - DEK: 32바이트 난수. 사진 원본·썸네일은 DEK 로만 AES-GCM 암호화 (사진마다 새 IV 12바이트)
 * - DEK 를 세 가지로 감싸서 보관: ① 비밀번호(PBKDF2-SHA256 60만 회 + salt) ② 복구 코드(120비트, PBKDF2 10만 회)
 *   ③ 지문(Android Keystore 인증 필수 열쇠 — src/lib/biometric.ts). 셋 중 하나로 DEK 를 꺼내면 열린다
 * - 열린 동안 DEK 는 추출 불가 CryptoKey 로 메모리에만. 원본 바이트는 감싸기·풀기 순간에만 쓰고 0 으로 지운다
 * - 잠금: 새로고침·로그아웃·백그라운드 전환(카메라·앨범 여는 동안 제외)·5분 무입력
 * - 서버·외부 API 로 보내는 코드 없음. 갤러리에 저장하는 코드 없음
 *
 * 예전(v1) 금고: 비밀번호 열쇠로 사진을 바로 암호화. 비밀번호로 처음 열 때 v2 로 옮긴다 (행마다 다시 풀어 비교 후 교체)
 */
import { biometric } from './biometric'

/** 최초 진입·설정·데이터 관리에 보여 주는 안내 (문구 고정) */
export const LOCAL_ONLY_NOTICE = '사진은 현재 기기에만 저장되며, 앱 삭제·데이터 삭제·기기 변경 시 복구되지 않을 수 있습니다'

const VERIFY = 'slimlog-eyebody-ok'
const LEGACY_ITER = 310_000
export const PW_ITER = 600_000
const RC_ITER = 100_000
const KDF = 'PBKDF2-SHA256'

export type Angle = 'front' | 'side' | 'back'
export const ANGLES: { value: Angle; label: string }[] = [
  { value: 'front', label: '정면' },
  { value: 'side', label: '측면' },
  { value: 'back', label: '후면' },
]

export interface PhotoMeta {
  id: string
  takenAt: string // YYYY-MM-DD
  angle: Angle
  createdAt: string
  /** 아직 새 방식으로 옮기지 못한 예전 사진 (비밀번호로 열어야 보임) */
  legacy?: boolean
}
interface PhotoRow extends Omit<PhotoMeta, 'angle' | 'legacy'> {
  angle?: Angle // v1 행에는 없음 → 'front'
  v?: 2 // 없으면 v1(비밀번호 열쇠) 행
  iv: Uint8Array
  data: ArrayBuffer
  thumbIv: Uint8Array
  thumb: ArrayBuffer
}

interface Wrap {
  kdf: typeof KDF
  salt: Uint8Array
  iter: number
  iv: Uint8Array
  wrapped: ArrayBuffer
}
interface MetaV2 {
  version: 2
  pw: Wrap
  rc: Wrap | null
  rcConfirmed: boolean
  check: { iv: Uint8Array; data: ArrayBuffer }
  bio: boolean
  migration: 'pending' | 'done'
}
interface MetaV1 {
  salt: Uint8Array
  iv: Uint8Array
  check: ArrayBuffer
  iter?: number
}

let dek: CryptoKey | null = null
/** v1 → v2 이전 중에만 (비밀번호로 열었을 때) */
let legacyKey: CryptoKey | null = null
/** 복구 코드·지문으로 연 직후 새 비밀번호를 정할 때만 잠깐 보관 */
let resetRaw: Uint8Array | null = null
let dbName = 'slimlog-eyebody'

/** 같은 기기에서 계정이 바뀌어도 사진이 섞이지 않게 사용자별 DB */
export function setVaultUser(userId: string | null) {
  const next = userId ? `slimlog-eyebody-${userId}` : 'slimlog-eyebody'
  if (next !== dbName) {
    dbName = next
    lock()
  }
}
const bioKey = () => `eyebody-dek:${dbName}`

// ── IndexedDB ────────────────────────────────────────────────

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(dbName, 1)
    req.onupgradeneeded = () => {
      req.result.createObjectStore('meta')
      req.result.createObjectStore('photos', { keyPath: 'id' })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function tx<T>(store: 'meta' | 'photos', mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open()
  return new Promise<T>((resolve, reject) => {
    const t = db.transaction(store, mode)
    const r = run(t.objectStore(store))
    let result: T
    r.onsuccess = () => (result = r.result)
    t.oncomplete = () => resolve(result)
    t.onerror = () => reject(t.error ?? r.error)
    t.onabort = () => reject(t.error ?? new Error('저장이 취소됐어요.'))
  }).finally(() => db.close())
}

const getV2 = () => tx<MetaV2 | undefined>('meta', 'readonly', (s) => s.get('v2'))
const getV1 = () => tx<MetaV1 | undefined>('meta', 'readonly', (s) => s.get('key'))
const putV2 = (m: MetaV2) => tx('meta', 'readwrite', (s) => s.put(m, 'v2'))

// ── 암호 도구 ─────────────────────────────────────────────────

const te = new TextEncoder()
async function kek(secret: string, salt: Uint8Array, iterations: number) {
  const base = await crypto.subtle.importKey('raw', te.encode(secret), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: salt as BufferSource, iterations, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
}
const enc = async (k: CryptoKey, data: BufferSource) => {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  return { iv, data: await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, k, data) }
}
const dec = (k: CryptoKey, iv: Uint8Array, data: ArrayBuffer) => crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv as BufferSource }, k, data)
const importDek = (raw: Uint8Array) => crypto.subtle.importKey('raw', raw as BufferSource, 'AES-GCM', false, ['encrypt', 'decrypt'])

async function wrapWith(secret: string, iterations: number, raw: Uint8Array): Promise<Wrap> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const k = await kek(secret, salt, iterations)
  const e = await enc(k, raw as BufferSource)
  return { kdf: KDF, salt, iter: iterations, iv: e.iv, wrapped: e.data }
}
async function unwrapWith(secret: string, w: Wrap): Promise<Uint8Array> {
  const k = await kek(secret, w.salt, w.iter)
  return new Uint8Array(await dec(k, w.iv, w.wrapped))
}
/** 꺼낸 DEK 가 이 금고의 것인지 확인 (check 를 풀어 본다) */
async function verifyDek(raw: Uint8Array, m: MetaV2): Promise<CryptoKey> {
  const k = await importDek(raw)
  const ok = new TextDecoder().decode(await dec(k, m.check.iv, m.check.data)) === VERIFY
  if (!ok) throw new Error('열쇠가 맞지 않아요.')
  return k
}
const wipe = (b: Uint8Array | null) => b?.fill(0)
const b64 = (b: Uint8Array) => btoa(String.fromCharCode(...b))
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))
const sameBytes = (a: ArrayBuffer, b: ArrayBuffer) => {
  if (a.byteLength !== b.byteLength) return false
  const x = new Uint8Array(a)
  const y = new Uint8Array(b)
  for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return false
  return true
}

// ── 복구 코드 (Crockford Base32, 24자 = 120비트) ─────────────────

const B32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
export const RECOVERY_LEN = 24
export function generateRecoveryCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(RECOVERY_LEN))
  const s = Array.from(bytes, (b) => B32[b & 31]).join('') // 256 % 32 = 0 → 치우침 없음
  return s.match(/.{4}/g)!.join('-')
}
/** 입력 정리: 대문자, 구분자 제거, 헷갈리는 글자(O→0, I·L→1) 바로잡기 */
export function normalizeRecoveryCode(input: string): string | null {
  const s = input.toUpperCase().replace(/[^0-9A-Z]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1')
  if (s.length !== RECOVERY_LEN || [...s].some((c) => !B32.includes(c))) return null
  return s
}
const rcSecret = (code: string) => normalizeRecoveryCode(code)!

// ── 상태 ──────────────────────────────────────────────────────

export async function vaultState(): Promise<'new' | 'locked' | 'unlocked'> {
  const [v2, v1] = await Promise.all([getV2(), getV1()])
  if (!v2 && !v1) return 'new'
  return dek || (legacyKey && !v2) ? 'unlocked' : 'locked'
}

export interface VaultInfo {
  bio: boolean
  rcConfirmed: boolean
  migration: 'pending' | 'done' | 'legacy'
  legacyLeft: number
}
export async function vaultInfo(): Promise<VaultInfo> {
  const [v2, rows] = await Promise.all([getV2(), tx<PhotoRow[]>('photos', 'readonly', (s) => s.getAll())])
  const legacyLeft = rows.filter((r) => r.v !== 2).length
  if (!v2) return { bio: false, rcConfirmed: false, migration: 'legacy', legacyLeft }
  return { bio: v2.bio, rcConfirmed: v2.rcConfirmed, migration: v2.migration, legacyLeft }
}

export const isUnlocked = () => dek !== null

/** 새 금고 — 복구 코드를 돌려준다 (화면에 한 번 보여 주고 저장하지 않음) */
export async function createVault(password: string): Promise<{ recoveryCode: string }> {
  if (password.length < 6) throw new Error('비밀번호는 6자 이상이에요.')
  const [v2, v1] = await Promise.all([getV2(), getV1()])
  // 이미 금고가 있으면 덮어쓰지 않는다 (덮어쓰면 기존 사진을 영영 못 연다)
  if (v2 || v1) throw new Error('이미 비밀번호가 있어요. 잠금 해제를 해 주세요.')
  const raw = crypto.getRandomValues(new Uint8Array(32))
  const recoveryCode = generateRecoveryCode()
  try {
    const k = await importDek(raw)
    const check = await enc(k, te.encode(VERIFY))
    await putV2({
      version: 2,
      pw: await wrapWith(password, PW_ITER, raw),
      rc: await wrapWith(rcSecret(recoveryCode), RC_ITER, raw),
      rcConfirmed: false,
      check,
      bio: false,
      migration: 'done',
    })
    dek = k
    return { recoveryCode }
  } finally {
    wipe(raw)
  }
}

export interface UnlockResult {
  /** v1 → v2 이전으로 새로 만든 복구 코드 (화면에 보여 줘야 함) */
  recoveryCode?: string
  migrated?: { moved: number; total: number }
}

/** 비밀번호로 열기 — 예전 금고면 여기서 새 방식으로 옮긴다 */
export async function unlock(password: string, onProgress?: (done: number, total: number) => void): Promise<UnlockResult> {
  const [v2, v1] = await Promise.all([getV2(), getV1()])
  if (!v2 && !v1) throw new Error('금고가 없어요.')
  const wrong = () => new Error('비밀번호가 맞지 않아요.')

  if (!v2 && v1) {
    // ① 예전 금고: 비밀번호 확인 → DEK 만들고 감싸서 저장(pending) → 사진 옮기기
    const lk = await kek(password, v1.salt, v1.iter ?? LEGACY_ITER)
    try {
      if (new TextDecoder().decode(await dec(lk, v1.iv, v1.check)) !== VERIFY) throw new Error()
    } catch {
      throw wrong()
    }
    const raw = crypto.getRandomValues(new Uint8Array(32))
    const recoveryCode = generateRecoveryCode()
    try {
      const k = await importDek(raw)
      await putV2({
        version: 2,
        pw: await wrapWith(password, PW_ITER, raw),
        rc: await wrapWith(rcSecret(recoveryCode), RC_ITER, raw),
        rcConfirmed: false,
        check: await enc(k, te.encode(VERIFY)),
        bio: false,
        migration: 'pending',
      })
      dek = k
      legacyKey = lk
    } finally {
      wipe(raw)
    }
    try {
      return { recoveryCode, migrated: await migrateLegacy(onProgress) }
    } catch (e) {
      lock() // 옮기다 멈추면 잠근다. 옮긴 행은 v2, 남은 행·예전 확인값은 그대로 → 다음에 비밀번호로 열면 이어서
      throw e
    }
  }

  // ② v2 금고
  let raw: Uint8Array
  try {
    raw = await unwrapWith(password, v2!.pw)
  } catch {
    throw wrong()
  }
  try {
    dek = await verifyDek(raw, v2!)
  } finally {
    wipe(raw)
  }
  if (v2!.migration === 'pending' && v1) {
    // 중간에 끊긴 이전 이어서 (pending 동안은 비밀번호 변경을 막아서 같은 비밀번호)
    try {
      legacyKey = await kek(password, v1.salt, v1.iter ?? LEGACY_ITER)
      if (new TextDecoder().decode(await dec(legacyKey, v1.iv, v1.check)) !== VERIFY) throw new Error()
    } catch {
      legacyKey = null
      return {}
    }
    try {
      return { migrated: await migrateLegacy(onProgress) }
    } catch (e) {
      lock()
      throw e
    }
  }
  return {}
}

/**
 * v1 행 → v2 행. 행마다: 예전 열쇠로 풀기 → DEK 로 암호화 → 새 암호문을 다시 풀어 원본과 바이트 비교 → 같을 때만 덮어쓰기.
 * 행 단위 트랜잭션이라 중간에 꺼져도 각 행은 '옛것' 아니면 '새것'. 전부 옮긴 뒤에만 예전 확인값(meta.key)을 지운다.
 */
async function migrateLegacy(onProgress?: (done: number, total: number) => void): Promise<{ moved: number; total: number }> {
  if (!dek || !legacyKey) throw new Error('잠겨 있어요.')
  const rows = (await tx<PhotoRow[]>('photos', 'readonly', (s) => s.getAll())).filter((r) => r.v !== 2)
  let moved = 0
  for (const r of rows) {
    let full: ArrayBuffer, small: ArrayBuffer
    try {
      full = await dec(legacyKey, r.iv, r.data)
      small = await dec(legacyKey, r.thumbIv, r.thumb)
    } catch {
      throw new Error(`예전 사진 하나를 옮기지 못했어요 (${moved}/${rows.length}장 옮김). 남은 사진은 그대로 있어요. 다시 열면 이어서 옮겨요.`)
    }
    const a = await enc(dek, full)
    const b = await enc(dek, small)
    // 검증: 새 암호문을 풀면 원래 사진과 똑같아야 한다
    if (!sameBytes(await dec(dek, a.iv, a.data), full) || !sameBytes(await dec(dek, b.iv, b.data), small)) throw new Error('사진을 옮기다 검증에 실패했어요. 예전 사진은 그대로 있어요.')
    const next: PhotoRow = { ...r, v: 2, iv: a.iv, data: a.data, thumbIv: b.iv, thumb: b.data }
    await tx('photos', 'readwrite', (s) => s.put(next))
    moved++
    onProgress?.(moved, rows.length)
  }
  // 전부 v2 인지 다시 확인한 뒤에만 마무리
  const left = (await tx<PhotoRow[]>('photos', 'readonly', (s) => s.getAll())).filter((r) => r.v !== 2).length
  if (left === 0) {
    const m = await getV2()
    const db = await open()
    await new Promise<void>((resolve, reject) => {
      const t = db.transaction('meta', 'readwrite')
      t.objectStore('meta').put({ ...m!, migration: 'done' }, 'v2')
      t.objectStore('meta').delete('key')
      t.oncomplete = () => resolve()
      t.onerror = () => reject(t.error)
    }).finally(() => db.close())
    legacyKey = null
  }
  return { moved, total: rows.length }
}

/** 복구 코드로 열기 → 새 비밀번호를 정해야 함 (setNewPassword) */
export async function unlockWithRecovery(code: string): Promise<void> {
  const norm = normalizeRecoveryCode(code)
  if (!norm) throw new Error('복구 코드 24자리를 확인해 주세요.')
  const v2 = await getV2()
  if (!v2?.rc) throw new Error('이 금고에는 복구 코드가 없어요.')
  let raw: Uint8Array
  try {
    raw = await unwrapWith(norm, v2.rc)
  } catch {
    throw new Error('복구 코드가 맞지 않아요.')
  }
  dek = await verifyDek(raw, v2)
  wipe(resetRaw)
  resetRaw = raw
}

/** 지문으로 열기. forReset 이면 이어서 새 비밀번호를 정할 수 있게 열쇠를 잠깐 보관 */
export async function unlockWithBiometric(forReset = false): Promise<void> {
  const v2 = await getV2()
  if (!v2?.bio) throw new Error('지문 잠금이 꺼져 있어요.')
  const raw = unb64(await biometric.load(bioKey()))
  try {
    dek = await verifyDek(raw, v2)
  } catch (e) {
    wipe(raw)
    throw e
  }
  if (forReset) {
    wipe(resetRaw)
    resetRaw = raw
  } else wipe(raw)
}

/** 복구 코드·지문으로 연 직후 새 비밀번호 */
export async function setNewPassword(password: string): Promise<void> {
  if (password.length < 6) throw new Error('비밀번호는 6자 이상이에요.')
  if (!resetRaw) throw new Error('먼저 지문이나 복구 코드로 열어 주세요.')
  const v2 = (await getV2())!
  if (v2.migration === 'pending') throw new Error('예전 사진을 옮기는 중이라 지금은 비밀번호를 바꿀 수 없어요. 원래 비밀번호로 한 번 열어 주세요.')
  try {
    await putV2({ ...v2, pw: await wrapWith(password, PW_ITER, resetRaw) })
  } finally {
    wipe(resetRaw)
    resetRaw = null
  }
}

/** 지금 비밀번호 → 새 비밀번호 */
export async function changePassword(current: string, next: string): Promise<void> {
  if (next.length < 6) throw new Error('새 비밀번호는 6자 이상이에요.')
  const v2 = await getV2()
  if (!v2) throw new Error('먼저 잠금을 해제해 주세요.')
  if (v2.migration === 'pending') throw new Error('예전 사진을 옮기는 중이라 지금은 비밀번호를 바꿀 수 없어요.')
  let raw: Uint8Array
  try {
    raw = await unwrapWith(current, v2.pw)
  } catch {
    throw new Error('지금 비밀번호가 맞지 않아요.')
  }
  try {
    await verifyDek(raw, v2)
    await putV2({ ...v2, pw: await wrapWith(next, PW_ITER, raw) })
  } finally {
    wipe(raw)
  }
}

/** 복구 코드 새로 만들기 (예전 코드는 바로 무효) */
export async function regenerateRecoveryCode(password: string): Promise<string> {
  const v2 = await getV2()
  if (!v2) throw new Error('먼저 잠금을 해제해 주세요.')
  let raw: Uint8Array
  try {
    raw = await unwrapWith(password, v2.pw)
  } catch {
    throw new Error('비밀번호가 맞지 않아요.')
  }
  try {
    await verifyDek(raw, v2)
    const code = generateRecoveryCode()
    await putV2({ ...v2, rc: await wrapWith(rcSecret(code), RC_ITER, raw), rcConfirmed: false })
    return code
  } finally {
    wipe(raw)
  }
}

export async function confirmRecoverySaved() {
  const v2 = await getV2()
  if (v2) await putV2({ ...v2, rcConfirmed: true })
}

/** 지문 잠금 켜기 — 비밀번호로 한 번 더 확인하고 DEK 를 Keystore 보호 저장소에 넣는다 */
export async function enableBiometric(password: string): Promise<void> {
  const v2 = await getV2()
  if (!v2) throw new Error('먼저 잠금을 해제해 주세요.')
  const avail = await biometric.available()
  if (!avail.ok) throw new Error(avail.reason ?? '이 기기에서는 지문 잠금을 쓸 수 없어요.')
  let raw: Uint8Array
  try {
    raw = await unwrapWith(password, v2.pw)
  } catch {
    throw new Error('비밀번호가 맞지 않아요.')
  }
  try {
    await verifyDek(raw, v2)
    await biometric.store(bioKey(), b64(raw))
    await putV2({ ...v2, bio: true })
  } finally {
    wipe(raw)
  }
}

export async function disableBiometric(): Promise<void> {
  await biometric.remove(bioKey()).catch(() => {})
  const v2 = await getV2()
  if (v2) await putV2({ ...v2, bio: false })
}

export function lock() {
  dek = null
  legacyKey = null
  wipe(resetRaw)
  resetRaw = null
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(LOCK_EVENT))
}
export const LOCK_EVENT = 'slimlog:eyebody-lock'

// ── 자동 잠금: 백그라운드 전환 즉시 · 5분 무입력 (카메라·앨범 여는 동안은 예외) ──

export const IDLE_LOCK_MS = 5 * 60 * 1000
let pickerOpen = false
let lastActive = Date.now()
/** 카메라·앨범을 열 때 부른다 — 그 사이 앱이 잠깐 백그라운드로 가도 잠그지 않음 */
export function beginPicker() {
  pickerOpen = true
  const done = () => {
    setTimeout(() => (pickerOpen = false), 1500)
    window.removeEventListener('focus', done)
  }
  window.addEventListener('focus', done)
  setTimeout(() => (pickerOpen = false), 3 * 60 * 1000) // 안전장치
}
export const endPicker = () => (pickerOpen = false)
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && !pickerOpen && (dek || legacyKey)) lock()
  })
  for (const ev of ['pointerdown', 'keydown', 'touchstart', 'wheel'] as const) document.addEventListener(ev, () => (lastActive = Date.now()), { passive: true })
  setInterval(() => {
    if ((dek || legacyKey) && !pickerOpen && Date.now() - lastActive >= IDLE_LOCK_MS) lock()
  }, 15_000)
}

// ── 사진 ──────────────────────────────────────────────────────

async function resize(file: Blob, max: number): Promise<ArrayBuffer> {
  const bmp = await createImageBitmap(file)
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height))
  const c = document.createElement('canvas')
  c.width = Math.round(bmp.width * scale)
  c.height = Math.round(bmp.height * scale)
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height)
  bmp.close()
  // 캔버스로 다시 그려서 저장 → 촬영 위치 등 EXIF 정보가 남지 않는다
  const blob = await new Promise<Blob>((r) => c.toBlob((b) => r(b!), 'image/jpeg', 0.88))
  c.width = c.height = 0
  return blob.arrayBuffer()
}

const toMeta = (r: PhotoRow): PhotoMeta => ({ id: r.id, takenAt: r.takenAt, angle: r.angle ?? 'front', createdAt: r.createdAt, ...(r.v !== 2 && { legacy: true }) })

/**
 * 사진 저장. replaceIds 를 주면 새 사진을 먼저 저장한 뒤에 기존 사진을 지운다
 * (중간에 실패해도 사진이 하나도 없는 상태가 되지 않게)
 */
export async function addPhoto(file: Blob, takenAt: string, angle: Angle = 'front', replaceIds: string[] = []): Promise<PhotoMeta> {
  if (!dek) throw new Error('잠겨 있어요.')
  const [full, small] = await Promise.all([resize(file, 1600), resize(file, 320)])
  const a = await enc(dek, full)
  const b = await enc(dek, small)
  const row: PhotoRow = { id: crypto.randomUUID(), takenAt, angle, v: 2, createdAt: new Date().toISOString(), iv: a.iv, data: a.data, thumbIv: b.iv, thumb: b.data }
  await tx('photos', 'readwrite', (s) => s.put(row))
  for (const id of replaceIds) await removePhoto(id)
  return toMeta(row)
}

/** 날짜·각도만 바꾸기 — 암호화된 사진은 그대로 둔다. replaceIds 는 옮긴 뒤에 지운다 */
export async function updatePhotoMeta(id: string, patch: { takenAt?: string; angle?: Angle }, replaceIds: string[] = []): Promise<PhotoMeta> {
  const row = await tx<PhotoRow | undefined>('photos', 'readonly', (s) => s.get(id))
  if (!row) throw new Error('사진이 없어요.')
  const next: PhotoRow = { ...row, ...patch }
  await tx('photos', 'readwrite', (s) => s.put(next))
  for (const r of replaceIds) if (r !== id) await removePhoto(r)
  return toMeta(next)
}

export async function listPhotos(): Promise<PhotoMeta[]> {
  const rows = await tx<PhotoRow[]>('photos', 'readonly', (s) => s.getAll())
  return rows.map(toMeta).sort((a, b) => b.takenAt.localeCompare(a.takenAt) || b.createdAt.localeCompare(a.createdAt))
}

/** 복호화한 사진의 임시 주소 (메모리 blob, 다 쓰면 URL.revokeObjectURL) */
export async function photoUrl(id: string, thumb = false): Promise<string> {
  const row = await tx<PhotoRow | undefined>('photos', 'readonly', (s) => s.get(id))
  if (!row) throw new Error('사진이 없어요.')
  const k = row.v === 2 ? dek : legacyKey
  if (!k) throw new Error(row.v === 2 ? '잠겨 있어요.' : '예전 사진은 비밀번호로 열어야 보여요.')
  const plain = await dec(k, thumb ? row.thumbIv : row.iv, thumb ? row.thumb : row.data)
  return URL.createObjectURL(new Blob([plain], { type: 'image/jpeg' }))
}

export const removePhoto = (id: string) => tx('photos', 'readwrite', (s) => s.delete(id))

export async function countPhotos(): Promise<number> {
  return tx<number>('photos', 'readonly', (s) => s.count())
}

/** 회원 탈퇴: 이 사용자의 기기 눈바디 사진·비밀번호·복구 코드·지문 키를 모두 지운다 */
export async function wipeVaultForUser(userId: string) {
  setVaultUser(userId)
  await wipeVault()
  setVaultUser(null)
}

/** 전부 지우기 (비밀번호·복구 코드·지문 모두 없을 때 새로 시작). 지문 보호 저장값도 지운다 */
export async function wipeVault() {
  lock()
  await biometric.remove(bioKey()).catch(() => {})
  await new Promise<void>((resolve, reject) => {
    const r = indexedDB.deleteDatabase(dbName)
    r.onsuccess = () => resolve()
    r.onerror = () => reject(r.error)
    r.onblocked = () => resolve()
  })
}
