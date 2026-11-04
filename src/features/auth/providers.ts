/**
 * 소셜 로그인 제공자 설정.
 * enabled=false면 화면에 보이지 않는다 — 심사·연동 준비가 끝나면 true로 바꾼다.
 * Supabase Auth: kakao·google·apple은 기본 제공, naver는 커스텀 OAuth 구성이 필요하다.
 */
export type ProviderId = 'kakao' | 'naver' | 'google' | 'apple'

export const PROVIDERS: { id: ProviderId; label: string; enabled: boolean; note: string }[] = [
  { id: 'kakao', label: '카카오 로그인', enabled: true, note: '이메일 받으려면 개인 개발자 비즈 앱 전환 + 동의항목 심사' },
  { id: 'google', label: 'Google로 계속하기', enabled: false, note: '카카오만 사용하기로 해 숨김. 기본 범위(이메일·프로필)는 앱 검증 없이 공개 가능' },
  { id: 'apple', label: 'Apple로 계속하기', enabled: false, note: '카카오만 사용하기로 해 숨김. Apple Developer Program(연 99달러) 가입 필요, HTTPS 도메인 필요' },
  { id: 'naver', label: '네이버 로그인', enabled: false, note: '전체 공개 전 네이버 검수 필요, Supabase 커스텀 연동 필요 — 발표 이후' },
]
