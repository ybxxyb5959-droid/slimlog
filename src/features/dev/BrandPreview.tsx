import { Logo, LogoAppIcon } from '@/components/brand/Logo'
import { PageHeader } from '@/components/common/PageHeader'

/** 로고 시안 검토 화면 (메뉴 비노출) — 확정 전에는 실제 화면에 적용하지 않는다 */
export function BrandPreview() {
  return (
    <>
      <PageHeader title="로고 시안" description="첨부 이미지와 비교용 · 확정 전 미적용" back="/home" />
      <div className="grid gap-3 md:grid-cols-2">
        <div className="flex min-h-[260px] items-center justify-center rounded-card" style={{ background: '#E9F7F1' }}>
          <Logo variant="vertical" size={92} />
        </div>
        <div className="flex min-h-[260px] items-center justify-center rounded-card bg-[#1A1E1C]">
          <LogoAppIcon size={120} />
        </div>
        <div className="flex min-h-[140px] items-center justify-center rounded-card border border-border bg-surface">
          <Logo size={44} />
        </div>
        <div className="flex min-h-[140px] items-center justify-center rounded-card bg-[#1A1E1C]">
          <Logo size={44} tone="white" />
        </div>
        <div className="flex min-h-[140px] items-center justify-center gap-6 rounded-card border border-border bg-surface text-text">
          <Logo variant="symbol" size={64} />
          <Logo variant="symbol" size={64} tone="mono" />
          <Logo size={36} tone="mono" />
        </div>
        <div className="flex min-h-[140px] items-end justify-center gap-4 rounded-card border border-border bg-surface pb-8">
          {[16, 24, 32, 48, 64].map((s) => (
            <LogoAppIcon key={s} size={s} />
          ))}
        </div>
      </div>
      <p className="mt-4 text-[13px] text-text-muted">SVG 파일: public/brand/ (symbol · horizontal · vertical · mono · white · app-icon · maskable)</p>
    </>
  )
}
