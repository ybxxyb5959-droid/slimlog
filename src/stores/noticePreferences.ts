import { create } from 'zustand'

/**
 * 안내 "다시 보지 않기" 설정.
 * 목업: localStorage 구현. 서비스 단계: 같은 인터페이스로 로그인 사용자별 서버 설정 구현으로 교체.
 * version을 올리면(계산 모델·유의사항이 실질적으로 바뀌면) 이전 선택과 상관없이 다시 표시된다.
 */
export interface NoticeDef {
  id: string
  version: number
}

export interface NoticePreferenceRepository {
  isDismissed(notice: NoticeDef): boolean
  setDismissed(notice: NoticeDef, dismissed: boolean): void
}

const key = (n: NoticeDef) => `slimlog:notice:${n.id}`

export const localNoticeRepository: NoticePreferenceRepository = {
  isDismissed(n) {
    try {
      const raw = window.localStorage.getItem(key(n))
      if (!raw) return false
      const saved = JSON.parse(raw) as { version?: number; dismissed?: boolean }
      return saved.dismissed === true && saved.version === n.version
    } catch {
      return false // 저장소를 못 쓰면 매번 보여준다 (안전한 쪽)
    }
  },
  setDismissed(n, dismissed) {
    try {
      if (dismissed) window.localStorage.setItem(key(n), JSON.stringify({ version: n.version, dismissed: true }))
      else window.localStorage.removeItem(key(n))
    } catch {
      /* 저장 실패 시 이번 방문에만 적용 */
    }
  },
}

/** 분석 탭 약물 추정 그래프 유의사항 */
export const ANALYSIS_PK_NOTICE: NoticeDef = { id: 'analysis-pk', version: 1 }

/** 분석 탭 안내 시트 열림 상태 (화면 어디서든 ⓘ로 다시 열기) */
export const useAnalysisNoticeStore = create<{ open: boolean; setOpen: (open: boolean) => void }>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}))
