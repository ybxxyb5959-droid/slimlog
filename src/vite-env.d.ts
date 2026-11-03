/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Supabase 프로젝트 주소 — 있으면 실서비스 모드, 없으면 목업 모드 */
  readonly VITE_SUPABASE_URL?: string
  /** Supabase anon(publishable) 키 — 브라우저에 공개돼도 되는 키. service_role 키는 절대 넣지 않는다 */
  readonly VITE_SUPABASE_ANON_KEY?: string
  /** '1' 이면 개발용 이메일 로그인 노출 (개발 서버 + 로컬 Supabase 전용) */
  readonly VITE_DEV_LOGIN?: string
  readonly VITE_PREVIEW?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
