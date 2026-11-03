import { useState } from 'react'
import { toast } from 'sonner'

import { PageHeader } from '@/components/common/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MOCK_TODAY_CHECK } from '@/fixtures/records.mock'
import { ANALYSIS_PK_NOTICE, localNoticeRepository } from '@/stores/noticePreferences'

import { MyGroup, SettingRow } from './MyRow'

export function AppSettingsPage() {
  const [protein, setProtein] = useState(String(MOCK_TODAY_CHECK.proteinGoalG))
  const [water, setWater] = useState(String(MOCK_TODAY_CHECK.waterGoalCups))
  return (
    <>
      <PageHeader title="화면 및 앱 환경" back="/my/settings" />
      <div className="space-y-6 md:max-w-2xl">
        <MyGroup title="기록 목표">
          <SettingRow id="proteinGoal" label="하루 단백질 목표" description="홈과 식단 분석의 목표선에 쓰여요">
            <div className="relative w-28">
              <Input id="proteinGoal" type="number" inputMode="numeric" min={0} value={protein} onChange={(e) => setProtein(e.target.value)} className="h-11 pr-8 text-right" />
              <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[13px] text-text-muted">g</span>
            </div>
          </SettingRow>
          <SettingRow id="waterGoal" label="하루 물 목표" description="1컵 = 250ml">
            <div className="relative w-28">
              <Input id="waterGoal" type="number" inputMode="numeric" min={0} value={water} onChange={(e) => setWater(e.target.value)} className="h-11 pr-8 text-right" />
              <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[13px] text-text-muted">컵</span>
            </div>
          </SettingRow>
        </MyGroup>
        <p className="-mt-3 px-1 text-[12px] text-text-subtle">목표는 직접 정하는 값이에요. 앱이 목표 섭취량을 추천하지 않아요.</p>
        <MyGroup title="화면">
          <SettingRow id="theme" label="다크 모드" description="색 토큰은 준비됐고 화면 적용은 다음 단계예요">
            <Badge tone="review">준비 중</Badge>
          </SettingRow>
          <SettingRow id="units" label="단위" description="체중 kg · 키 cm">
            <Badge>고정</Badge>
          </SettingRow>
          <SettingRow id="noticeReset" label="분석 유의사항 다시 보기" description="‘다시 보지 않기’를 해제하고 분석 탭에 들어갈 때 다시 보여줘요">
            <Button
              id="noticeReset"
              variant="outline"
              size="sm"
              onClick={() => {
                localNoticeRepository.setDismissed(ANALYSIS_PK_NOTICE, false)
                toast.success('다음에 분석 탭에 들어가면 유의사항이 다시 보여요')
              }}
            >
              다시 보기
            </Button>
          </SettingRow>
        </MyGroup>
        <Button size="lg" className="w-full" onClick={() => toast.success('목업: 화면에만 저장됐어요')}>
          저장
        </Button>
      </div>
    </>
  )
}
