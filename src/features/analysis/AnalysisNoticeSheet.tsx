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
  { icon: ActivitySquare, title: '실제 측정값이 아니에요', body: '혈중농도나 체내 잔존량을 직접 잰 값이 아니에요.' },
  { icon: HeartPulse, title: '약효·부작용을 예측하지 않아요', body: '그래프만으로 약효나 부작용의 세기를 알 수 없어요.' },
  { icon: ShieldCheck, title: '투약 결정에 쓰지 마세요', body: '용량이나 일정은 의료진의 안내를 따라 주세요.' },
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
        <div className="space-y-2.5">
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
      <div className="space-y-6 pt-1 pb-2">
        <p className="text-[15px] leading-[1.7] break-keep text-text">
          참고용 잔존량 그래프는 내가 입력한 투약 기록과
          <br />
          약물별 참고 자료로 계산한 <b className="font-semibold">추정값</b>이에요.
        </p>
        <ul className="space-y-5">
          {POINTS.map((p) => (
            <li key={p.title} className="flex items-start gap-3.5">
              <AppIcon icon={p.icon} size="sm" bg="soft" className="mt-0.5 shrink-0" />
              <div className="min-w-0 space-y-1">
                <p className="text-[15px] leading-snug font-semibold break-keep text-text">{p.title}</p>
                <p className="text-[13px] leading-[1.6] break-keep text-text-muted">{p.body}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </BottomSheet>
  )
}
