/**
 * 키보드가 올라와도 입력 중인 칸이 보이게 (갤럭시 앱·모바일 웹 공통)
 * 1) 입력칸에 들어가면 키보드가 다 올라온 뒤 그 칸을 화면 가운데로 스크롤 (바텀시트 안 칸도 같이)
 * 2) 키보드가 열려 있는 동안 <html data-keyboard="open"> → 하단 탭바·하단 고정 버튼을 숨겨 가리지 않게 (globals.css)
 * 키보드 열림 판단: 화면(visualViewport) 높이가 평소 최대 높이보다 150px 넘게 줄었을 때
 */
const TYPING = 'input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=file]):not([type=button]):not([type=submit]), textarea, [contenteditable="true"]'

let started = false
export function startKeyboardAssist() {
  if (started || typeof window === 'undefined') return
  started = true
  const vv = window.visualViewport
  let maxH = Math.max(window.innerHeight, vv?.height ?? 0)

  const isTyping = (el: Element | null): el is HTMLElement => !!el && el instanceof HTMLElement && el.matches(TYPING)
  const reveal = () => {
    const el = document.activeElement
    if (!isTyping(el)) return
    el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' })
  }
  const update = () => {
    const h = vv?.height ?? window.innerHeight
    // 화면 회전 등으로 평소 높이가 바뀌면 갱신 (키보드가 없을 때만)
    if (!isTyping(document.activeElement)) maxH = Math.max(h, window.innerHeight)
    else maxH = Math.max(maxH, window.innerHeight, h)
    const open = isTyping(document.activeElement) && maxH - Math.min(h, window.innerHeight) > 150
    document.documentElement.toggleAttribute('data-keyboard-open', open)
    if (open) reveal()
  }

  document.addEventListener('focusin', (e) => {
    if (!isTyping(e.target as Element)) return
    // 키보드가 올라오는 애니메이션(약 250ms) 뒤에 한 번 더
    window.setTimeout(reveal, 120)
    window.setTimeout(update, 350)
  })
  document.addEventListener('focusout', () => window.setTimeout(update, 50))
  vv?.addEventListener('resize', update)
  window.addEventListener('resize', update)
}
