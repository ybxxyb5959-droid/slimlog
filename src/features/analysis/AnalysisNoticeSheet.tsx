import { ActivitySquare, HeartPulse, ShieldAlert, ShieldCheck, type LucideIcon } from 'lucide-react'
import { useState } from 'react'

import { AppIcon } from '@/components/common/AppIcon'
import { BottomSheet } from '@/components/common/BottomSheet'
import { Button } from '@/components/ui/button'
import {
  ANALYSIS_PK_NOTICE,
  localNoticeRepository,
  type NoticePreferenceRepository,
} from '@/stores/noticePreferences'

const POINTS: { icon: LucideIcon; title: string; body: string }[] = [
  { icon: ActivitySquare, title: '실제 측정값이 아니에요', body: '실제 혈중농도나 체내 잔존량을 직접 측정한 값이 아닙니다.' },
  { icon: HeartPulse, title: '약효·부작용을 예측하지 않아요', body: '그래프만으로 약효 또는 부작용 강도를 예측할 수 없습니다.' },
  { icon: ShieldCheck, title: '투약 결정에 사용하지 마세요', body: '투약 용량이나 일정을 결정하는 의료적 판단에 사용해서는 안 됩니다.' },
]

/** 분석 탭 최초 진입 유의사항 — 적용 범위: 약물 노출 추정 그래프 */
export function AnalysisNoticeSheet({
  open,
  onClose,
  repository = localNoticeRepository,
}: {
  open: boolean
  onClose: () => void
  repository?: NoticePreferenceRepository
}) {
  const [dontShow, setDontShow] = useState(() => repository.isDismissed(ANALYSIS_PK_NOTICE))

  const close = () => {
    repository.setDismissed(ANALYSIS_PK_NOTICE, dontShow)
    onClose()
  }

  return (
    <BottomSheet
      open={open}
      onRequestClose={close}
      header={<AppIcon icon={ShieldAlert} size="lg" bg="soft" className="mt-1" />}
      title="분석 결과를 확인하기 전에"
      description="참고용 계산값에 대한 안내"
      footer={
        <div className="space-y-3">
          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-[15px]">
            <input
              id="analysisNoticeDontShow"
              type="checkbox"
              checked={dontShow}
              onChange={(e) => setDontShow(e.target.checked)}
              className="size-5 accent-[var(--primary)]"
            />
            다시 보지 않기
          </label>
          <Button size="lg" className="w-full" onClick={close}>
            확인했어요
          </Button>
          <p className="text-center text-[12px] text-text-subtle">분석 화면의 ⓘ 버튼에서 언제든 다시 확인할 수 있어요.</p>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-[15px] leading-relaxed text-text">
          슬림로그의 약물 노출 추정 그래프는 사용자가 입력한 투약 기록과 약물별 참고 자료를 바탕으로 계산한 추정 결과입니다.
        </p>
        <ul className="space-y-3.5">
          {POINTS.map((p) => (
            <li key={p.title} className="flex gap-3">
              <AppIcon icon={p.icon} size="sm" className="mt-0.5" />
              <div>
                <p className="text-[15px] font-semibold text-text">{p.title}</p>
                <p className="text-[13px] leading-relaxed text-text-muted">{p.body}</p>
              </div>
            </li>
          ))}
        </ul>
        <p className="rounded-xl bg-surface-muted px-4 py-3 text-[13px] leading-relaxed text-text-muted">
          이 안내는 약물 노출 추정 그래프(참고용 잔존량)에 대한 내용이에요. 체중·식단·증상 분석은 입력한 기록을 그대로 보여줘요.
        </p>
      </div>
    </BottomSheet>
  )
}
