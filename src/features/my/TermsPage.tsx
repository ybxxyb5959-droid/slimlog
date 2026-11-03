import { PageHeader } from '@/components/common/PageHeader'
import { Card } from '@/components/ui/card'
import { CONSENT_ITEMS } from '@/fixtures/consents'

export function TermsPage() {
  return (
    <>
      <PageHeader title="이용약관 · 개인정보 처리방침" back="/my/settings" />
      <div className="space-y-3 md:max-w-2xl">
        {CONSENT_ITEMS.map((c) => (
          <Card key={c.id}>
            <h2 className="text-[15px] font-semibold">
              {c.title} <span className="text-[12px] font-medium text-text-muted">{c.required ? '필수' : '선택'}</span>
            </h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-[14px] leading-relaxed text-text-muted">
              {c.detail.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          </Card>
        ))}
        <p className="px-1 text-[12px] text-text-subtle">초안이에요. 출시 전 법률 검토가 필요해요.</p>
      </div>
    </>
  )
}
