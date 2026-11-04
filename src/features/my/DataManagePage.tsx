import { Camera, Download } from 'lucide-react'

import { PageHeader } from '@/components/common/PageHeader'
import { Badge } from '@/components/ui/badge'

import { MyGroup, MyRow, SettingRow } from './MyRow'

export function DataManagePage() {
  return (
    <>
      <PageHeader title="내 데이터 관리" back="/my/settings" />
      <div className="space-y-6 md:max-w-2xl">
        <MyGroup title="이 기기에 저장된 데이터">
          <MyRow to="/my/eyebody-data" icon={Camera} label="눈바디 로컬 데이터" meta="서버 전송 없음" />
        </MyGroup>
        <MyGroup title="서버에 저장된 기록">
          <SettingRow id="export" label="기록 내보내기" description="투약·체중·식단 기록을 파일로 받기">
            <span className="inline-flex items-center gap-1.5">
              <Download size={16} strokeWidth={1.75} className="text-text-subtle" aria-hidden />
              <Badge>준비하고 있어요</Badge>
            </span>
          </SettingRow>
        </MyGroup>
        <p className="px-1 text-[12px] leading-relaxed text-text-subtle">기록 전체 삭제는 회원 탈퇴 또는 민감정보 동의 철회로 할 수 있어요.</p>
      </div>
    </>
  )
}
