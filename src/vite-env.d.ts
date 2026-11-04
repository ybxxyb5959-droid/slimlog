/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Supabase 프로젝트 주소 — 있으면 실서비스 모드, 없으면 목업 모드 */
  readonly VITE_SUPABASE_URL?: string
  /** Supabase anon(publishable) 키 — 브라우저에 공개돼도 되는 키. service_role 키는 절대 넣지 않는다 */
  readonly VITE_SUPABASE_ANON_KEY?: string
  /** '1' 이면 개발용 이메일 로그인 노출 (개발 서버 + 로컬 Supabase 전용) */
  readonly VITE_DEV_LOGIN?: string
  /** SlimLog API(FastAPI) 주소 — 없으면 서버 기능(사진 인식·커뮤니티 쓰기·탈퇴)은 '준비 중' */
  readonly VITE_API_URL?: string
  readonly VITE_PREVIEW?: string
  /** E2E 테스트 빌드에서만 '1' — 가짜 지문 등 테스트 훅 (배포 빌드에는 넣지 않음) */
  readonly VITE_E2E_HOOKS?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
