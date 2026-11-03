import { useState } from 'react'
import { toast } from 'sonner'

import { Notice } from '@/components/common/Notice'
import { PageHeader } from '@/components/common/PageHeader'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'

import { MyGroup, SettingRow } from './MyRow'

export function NotificationSettingsPage() {
  const [notify, setNotify] = useState({ dose: true, daily: true, comment: false })
  return (
    <>
      <PageHeader title="알림 설정" back="/my/settings" />
      <div className="space-y-6 md:max-w-2xl">
        <MyGroup title="알림">
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
        <Notice>알림은 앱 설치와 알림 권한 허용 후에 동작해요. 지금은 목업이라 실제 알림이 가지 않아요.</Notice>
        <Button size="lg" className="w-full" onClick={() => toast.success('목업: 화면에만 저장됐어요')}>
          저장
        </Button>
      </div>
    </>
  )
}
