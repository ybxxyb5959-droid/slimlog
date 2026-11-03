import { useState } from 'react'
import { toast } from 'sonner'

import { Notice } from '@/components/common/Notice'
import { PageHeader } from '@/components/common/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { MOCK_TODAY_CHECK } from '@/fixtures/records.mock'

import { MyGroup, SettingRow } from './MyRow'

export function SettingsPage() {
  const [protein, setProtein] = useState(String(MOCK_TODAY_CHECK.proteinGoalG))
  const [water, setWater] = useState(String(MOCK_TODAY_CHECK.waterGoalCups))
  const [notify, setNotify] = useState({ dose: true, daily: true, comment: false })

  return (
    <>
      <PageHeader title="기록 · 알림 설정" back="/my" />
      <div className="space-y-6 md:max-w-2xl">
        <MyGroup title="기록 설정">
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

        <div id="notifications">
          <MyGroup title="알림 설정">
            <SettingRow id="nDose" label="투약 예정일 알림" description="마지막 기록 +7일 기준 (사용자 기록 기준)">
              <Switch id="nDose" checked={notify.dose} onCheckedChange={(v) => setNotify((s) => ({ ...s, dose: v }))} />
            </SettingRow>
            <SettingRow id="nDaily" label="기록 리마인더" description="매일 저녁 9시, 오늘 기록하지 않은 항목 안내">
              <Switch id="nDaily" checked={notify.daily} onCheckedChange={(v) => setNotify((s) => ({ ...s, daily: v }))} />
            </SettingRow>
            <SettingRow id="nComment" label="커뮤니티 댓글 알림">
              <Switch id="nComment" checked={notify.comment} onCheckedChange={(v) => setNotify((s) => ({ ...s, comment: v }))} />
            </SettingRow>
          </MyGroup>
        </div>
        <Notice>알림은 PWA 설치와 알림 권한 허용 후에 동작해요. 지금은 목업이라 실제 알림이 가지 않아요.</Notice>
        <Button size="lg" className="w-full" onClick={() => toast.success('목업: 화면에만 저장됐어요')}>
          저장
        </Button>
      </div>
    </>
  )
}
