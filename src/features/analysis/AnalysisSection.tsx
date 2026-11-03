import { Info } from 'lucide-react'
import { useEffect } from 'react'
import { Outlet } from 'react-router'

import { AppIcon } from '@/components/common/AppIcon'
import { ANALYSIS_PK_NOTICE, localNoticeRepository, useAnalysisNoticeStore } from '@/stores/noticePreferences'

import { AnalysisNoticeSheet } from './AnalysisNoticeSheet'

/**
 * 분석 탭 공통 레이아웃.
 * 탭에 들어올 때(이 컴포넌트가 마운트될 때)마다, '다시 보지 않기'가 아니면 유의사항을 연다.
 * 분석 하위 화면 사이 이동은 같은 방문으로 본다.
 */
export function AnalysisSection() {
  const { open, setOpen } = useAnalysisNoticeStore()

  useEffect(() => {
    if (!localNoticeRepository.isDismissed(ANALYSIS_PK_NOTICE)) setOpen(true)
    return () => setOpen(false)
  }, [setOpen])

  return (
    <>
      <Outlet />
      <AnalysisNoticeSheet open={open} onClose={() => setOpen(false)} />
    </>
  )
}

/** 분석 화면 헤더의 ⓘ — 유의사항 다시 열기 */
export function AnalysisNoticeButton() {
  const setOpen = useAnalysisNoticeStore((s) => s.setOpen)
  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="inline-flex size-11 items-center justify-center rounded-full hover:bg-surface-muted"
      aria-label="분석 유의사항 보기"
    >
      <AppIcon icon={Info} size="md" tone="muted" />
    </button>
  )
}
