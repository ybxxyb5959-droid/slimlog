import { PageHeader } from '@/components/common/PageHeader'
import { Card } from '@/components/ui/card'

export function SupportPage() {
  return (
    <>
      <PageHeader title="고객지원 · 서비스 정보" back="/my/settings" />
      <div className="space-y-4 md:max-w-2xl">
        <Card className="space-y-2">
          <h2 className="text-[15px] font-semibold">문의</h2>
          <p className="text-[14px] text-text-muted">문의 이메일</p>
          <p className="text-[15px] font-medium select-all">support@slimlog.example</p>
          <p className="text-[12px] text-text-subtle">예시 주소예요. 운영 주소가 정해지면 바꿔요.</p>
        </Card>
        <Card className="space-y-2 text-[14px]">
          <h2 className="text-[15px] font-semibold">서비스 정보</h2>
          <p className="flex justify-between">
            <span className="text-text-muted">버전</span>
            <span className="tabular">0.1.0 (UI 목업)</span>
          </p>
          <p className="leading-relaxed text-text-muted">
            슬림로그는 기록·정보 정리 서비스예요. 진단·처방·용량 결정을 하지 않고, 참고 곡선은 실제 혈중농도가 아니에요.
          </p>
        </Card>
      </div>
    </>
  )
}
