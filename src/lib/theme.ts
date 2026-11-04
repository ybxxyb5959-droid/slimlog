/**
 * 화면 테마 (밝게 / 어둡게 / 휴대폰 설정 따라가기)
 * - 기기마다 다른 취향이라 서버가 아니라 이 브라우저에만 저장한다
 * - 색은 styles/globals.css 의 토큰을 :root[data-slimlog-theme="dark"] 로 바꿔 끼운다
 * - index.html 의 작은 스크립트가 첫 화면 전에 같은 규칙으로 먼저 적용한다 (깜빡임 방지)
 */
export type ThemePref = 'system' | 'light' | 'dark'

const KEY = 'slimlog-theme'
const THEME_COLOR = { light: '#f6f7f5', dark: '#121514' } as const

export function getThemePref(): ThemePref {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'light' || v === 'dark' ? v : 'system'
  } catch {
    return 'system'
  }
}

const media = () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null)

export function resolveTheme(pref: ThemePref): 'light' | 'dark' {
  if (pref !== 'system') return pref
  return media()?.matches ? 'dark' : 'light'
}

function apply(pref: ThemePref) {
  const t = resolveTheme(pref)
  const root = document.documentElement
  if (t === 'dark') root.setAttribute('data-slimlog-theme', 'dark')
  else root.removeAttribute('data-slimlog-theme')
  root.style.colorScheme = t
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[t])
}

export function setThemePref(pref: ThemePref) {
  try {
    if (pref === 'system') localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, pref)
  } catch {
    /* 저장이 막힌 브라우저: 이번 화면에만 적용 */
  }
  apply(pref)
}

/** 앱 시작 시 한 번 — 휴대폰 설정이 바뀌면 '설정 따라가기'일 때만 따라 바꾼다 */
export function initTheme() {
  apply(getThemePref())
  media()?.addEventListener('change', () => {
    if (getThemePref() === 'system') apply('system')
  })
}
