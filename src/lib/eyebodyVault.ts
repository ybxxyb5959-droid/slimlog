/**
 * 눈바디 사진 금고 — 이 기기 브라우저(IndexedDB)에만, 비밀번호로 사진마다 암호화해서 저장한다.
 * - 키: 비밀번호 → PBKDF2(SHA-256, 사용자별 salt) → AES-GCM 256 (키는 추출 불가)
 *   반복 횟수는 금고마다 meta 에 저장: 새 금고 60만 회(OWASP 권장), 예전 금고는 31만 회 그대로 열림
 * - 사진마다 새 IV(12바이트 난수), 원본(긴 변 1600px)과 썸네일(320px)을 따로 암호화
 * - 키는 메모리에만 (새로고침·로그아웃·5분 이상 백그라운드면 다시 잠금). 비밀번호를 잊으면 복구할 수 없다
 * - 서버·외부 API 로 보내는 코드는 없다. 갤러리에 저장하는 코드도 없다
 * - 저장 형식(salt·IV·암호문)은 그 자체로 완결돼 있어서, 나중에 '선택적 암호화 백업'을 붙일 때
 *   이 행을 그대로 옮기면 된다 (서버는 암호문만 보관). 지금은 구현하지 않음
 *
 * 각도(정면·측면·후면): 예전 사진에는 angle 이 없다 → 읽을 때 'front' 로 본다 (저장된 데이터는 고치지 않음)
 */
/** 최초 진입·설정·데이터 관리에 보여 주는 안내 (문구 고정) */
export const LOCAL_ONLY_NOTICE = '사진은 현재 기기에만 저장되며, 앱 삭제·데이터 삭제·기기 변경 시 복구되지 않을 수 있습니다'

const LEGACY_ITER = 310_000
const ITER = 600_000
const VERIFY = 'slimlog-eyebody-ok'
let key: CryptoKey | null = null
let dbName = 'slimlog-eyebody'

/** 같은 기기에서 계정이 바뀌어도 사진이 섞이지 않게 사용자별 DB */
export function setVaultUser(userId: string | null) {
  const next = userId ? `slimlog-eyebody-${userId}` : 'slimlog-eyebody'
  if (next !== dbName) {
    dbName = next
    key = null
  }
}

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
}
interface PhotoRow extends Omit<PhotoMeta, 'angle'> {
  angle?: Angle // 예전 행에는 없음
  iv: Uint8Array
  data: ArrayBuffer
  thumbIv: Uint8Array
  thumb: ArrayBuffer
}

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
  return new Promise((resolve, reject) => {
    const r = run(db.transaction(store, mode).objectStore(store))
    r.onsuccess = () => resolve(r.result)
    r.onerror = () => reject(r.error)
  }).finally(() => db.close()) as Promise<T>
}

async function derive(password: string, salt: Uint8Array, iterations: number) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: salt as BufferSource, iterations, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
}
const enc = async (k: CryptoKey, data: BufferSource) => {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  return { iv, data: await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, k, data) }
}
const dec = (k: CryptoKey, iv: Uint8Array, data: ArrayBuffer) => crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv as BufferSource }, k, data)

export async function vaultState(): Promise<'new' | 'locked' | 'unlocked'> {
  const meta = await tx<{ salt: Uint8Array } | undefined>('meta', 'readonly', (s) => s.get('key'))
  if (!meta) return 'new'
  return key ? 'unlocked' : 'locked'
}

export async function createVault(password: string) {
  if (password.length < 6) throw new Error('비밀번호는 6자 이상이에요.')
  // 이미 금고가 있으면 덮어쓰지 않는다 (덮어쓰면 기존 사진을 영영 못 연다)
  if (await tx('meta', 'readonly', (s) => s.get('key'))) throw new Error('이미 비밀번호가 있어요. 잠금 해제를 해 주세요.')
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const k = await derive(password, salt, ITER)
  const v = await enc(k, new TextEncoder().encode(VERIFY))
  await tx('meta', 'readwrite', (s) => s.put({ salt, iv: v.iv, check: v.data, iter: ITER }, 'key'))
  key = k
}

export async function unlock(password: string) {
  const meta = await tx<{ salt: Uint8Array; iv: Uint8Array; check: ArrayBuffer; iter?: number } | undefined>('meta', 'readonly', (s) => s.get('key'))
  if (!meta) throw new Error('금고가 없어요.')
  const k = await derive(password, meta.salt, meta.iter ?? LEGACY_ITER)
  try {
    const ok = new TextDecoder().decode(await dec(k, meta.iv, meta.check)) === VERIFY
    if (!ok) throw new Error()
  } catch {
    throw new Error('비밀번호가 맞지 않아요.')
  }
  key = k
}

export const lock = () => (key = null)
export const isUnlocked = () => key !== null

// 5분 이상 다른 앱에 가 있으면 자동으로 잠근다
const AUTO_LOCK_MS = 5 * 60 * 1000
let hiddenAt = 0
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') hiddenAt = Date.now()
    else if (hiddenAt && Date.now() - hiddenAt >= AUTO_LOCK_MS) lock()
  })
}

async function resize(file: Blob, max: number): Promise<ArrayBuffer> {
  const bmp = await createImageBitmap(file)
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height))
  const c = document.createElement('canvas')
  c.width = Math.round(bmp.width * scale)
  c.height = Math.round(bmp.height * scale)
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height)
  // 캔버스로 다시 그려서 저장 → 촬영 위치 등 EXIF 정보가 남지 않는다
  const blob = await new Promise<Blob>((r) => c.toBlob((b) => r(b!), 'image/jpeg', 0.88))
  return blob.arrayBuffer()
}

const toMeta = (r: PhotoRow): PhotoMeta => ({ id: r.id, takenAt: r.takenAt, angle: r.angle ?? 'front', createdAt: r.createdAt })

/**
 * 사진 저장. replaceIds 를 주면 새 사진을 먼저 저장한 뒤에 기존 사진을 지운다
 * (중간에 실패해도 사진이 하나도 없는 상태가 되지 않게)
 */
export async function addPhoto(file: Blob, takenAt: string, angle: Angle = 'front', replaceIds: string[] = []): Promise<PhotoMeta> {
  if (!key) throw new Error('잠겨 있어요.')
  const [full, small] = await Promise.all([resize(file, 1600), resize(file, 320)])
  const a = await enc(key, full)
  const b = await enc(key, small)
  const row: PhotoRow = { id: crypto.randomUUID(), takenAt, angle, createdAt: new Date().toISOString(), iv: a.iv, data: a.data, thumbIv: b.iv, thumb: b.data }
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

/** 복호화한 사진의 임시 주소 (다 쓰면 URL.revokeObjectURL) */
export async function photoUrl(id: string, thumb = false): Promise<string> {
  if (!key) throw new Error('잠겨 있어요.')
  const row = await tx<PhotoRow | undefined>('photos', 'readonly', (s) => s.get(id))
  if (!row) throw new Error('사진이 없어요.')
  const plain = await dec(key, thumb ? row.thumbIv : row.iv, thumb ? row.thumb : row.data)
  return URL.createObjectURL(new Blob([plain], { type: 'image/jpeg' }))
}

export const removePhoto = (id: string) => tx('photos', 'readwrite', (s) => s.delete(id))

export async function countPhotos(): Promise<number> {
  return tx<number>('photos', 'readonly', (s) => s.count())
}

/** 전부 지우기 (비밀번호를 잊었을 때 새로 시작) */
export async function wipeVault() {
  key = null
  await new Promise<void>((resolve, reject) => {
    const r = indexedDB.deleteDatabase(dbName)
    r.onsuccess = () => resolve()
    r.onerror = () => reject(r.error)
    r.onblocked = () => resolve()
  })
}
