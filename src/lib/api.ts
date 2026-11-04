import { isLive, supabase } from '@/lib/supabase'

/**
 * SlimLog API(FastAPI) 호출 — 검사·계산·파일·추론·탈퇴처럼 서버를 거쳐야 하는 일만.
 * VITE_API_URL 이 없으면 서버 기능은 '준비 중'으로 둔다 (가짜 성공 응답을 만들지 않음).
 */
export const API_URL = (import.meta.env ?? {}).VITE_API_URL?.replace(/\/$/, '')
export const apiReady = isLive && !!API_URL

/**
 * 서버 미리 깨우기 — 무료 서버(Render)는 15분 쉬면 잠들어 첫 요청이 30~60초 걸린다.
 * 커뮤니티·글쓰기·사진 화면에 들어올 때 불러 두면 사용자가 입력하는 동안 깨어난다. (10분에 한 번만)
 */
let lastWake = 0
export function wakeServer() {
  if (!apiReady || Date.now() - lastWake < 10 * 60 * 1000) return
  lastWake = Date.now()
  fetch(`${API_URL}/health`, { method: 'GET', cache: 'no-store' }).catch(() => (lastWake = 0))
}

export class ApiError extends Error {
  status: number
  code: string
  field?: string | null
  extra?: Record<string, unknown>
  constructor(status: number, code: string, message: string, field?: string | null, extra?: Record<string, unknown>) {
    super(message)
    this.status = status
    this.code = code
    this.field = field
    this.extra = extra
  }
}

export async function api<T = unknown>(path: string, opts: { method?: string; json?: unknown; form?: FormData } = {}): Promise<T> {
  if (!apiReady) throw new ApiError(0, 'API_NOT_READY', '서버 연결 전이라 아직 쓸 수 없어요.')
  const { data } = await supabase!.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new ApiError(401, 'NO_TOKEN', '로그인이 필요해요.')
  let res: Response
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: opts.method ?? (opts.json || opts.form ? 'POST' : 'GET'),
      headers: { Authorization: `Bearer ${token}`, ...(opts.json ? { 'Content-Type': 'application/json' } : {}) },
      body: opts.form ?? (opts.json ? JSON.stringify(opts.json) : undefined),
    })
  } catch {
    throw new ApiError(0, 'NETWORK', '서버에 연결하지 못했어요. 인터넷 연결을 확인해 주세요.')
  }
  if (res.status === 204) return undefined as T
  const body = await res.json().catch(() => null)
  if (!res.ok) {
    const d = body?.detail ?? {}
    const { code, message, field, ...extra } = typeof d === 'object' ? d : {}
    throw new ApiError(res.status, code ?? 'ERROR', message ?? '요청을 처리하지 못했어요.', field, extra)
  }
  return body as T
}
