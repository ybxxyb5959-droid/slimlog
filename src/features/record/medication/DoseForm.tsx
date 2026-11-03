import { useState } from 'react'

import { ChipGroup } from '@/components/common/ChipGroup'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { INJECTION_SITES, MEDICATION_LIST, MEDICATIONS, siteLabel } from '@/fixtures/medications.mock'
import { toDateTimeLocalValue } from '@/lib/date'
import { validateDose, type DoseInput } from '@/services/doses'
import type { InjectionSite } from '@/types/domain'

import { draftToInput, type DoseDraft } from './doseDraft'

export function DoseForm({
  draft,
  onChange,
  onSubmit,
  submitLabel,
  lastSite,
  extraActions,
}: {
  draft: DoseDraft
  onChange: (d: DoseDraft) => void
  onSubmit: (input: DoseInput) => void | Promise<void>
  submitLabel: string
  lastSite?: InjectionSite
  extraActions?: React.ReactNode
}) {
  const [error, setError] = useState<{ field: string; message: string } | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const med = draft.medicationId ? MEDICATIONS[draft.medicationId] : null
  const set = (patch: Partial<DoseDraft>) => {
    setError(null)
    onChange({ ...draft, ...patch })
  }

  return (
    <form
      noValidate
      onSubmit={async (e) => {
        e.preventDefault()
        if (submitting) return // 중복 저장 방지
        const input = draftToInput(draft)
        const err = validateDose(input)
        if (err) return setError(err)
        setSubmitting(true)
        try {
          await onSubmit(input as DoseInput)
        } finally {
          setSubmitting(false)
        }
      }}
      className="space-y-6"
    >
      <fieldset>
        <Label asChild>
          <legend>약</legend>
        </Label>
        <ChipGroup
          label="약 선택"
          columns={3}
          options={MEDICATION_LIST.map((m) => ({ value: m.id, label: m.name }))}
          value={draft.medicationId}
          onChange={(v) => set({ medicationId: v, doseMg: null })}
        />
      </fieldset>

      <fieldset>
        <Label asChild>
          <legend>용량</legend>
        </Label>
        {med?.doseOptionsMg ? (
          <ChipGroup
            label="용량 선택"
            options={med.doseOptionsMg.map((mg) => ({ value: String(mg), label: `${mg} mg` }))}
            value={draft.doseMg !== null ? String(draft.doseMg) : null}
            onChange={(v) => set({ doseMg: Number(v) })}
          />
        ) : (
          <div className="relative">
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              placeholder="처방받은 용량"
              aria-label="용량 (mg)"
              aria-invalid={error?.field === 'doseMg'}
              value={draft.doseMg ?? ''}
              onChange={(e) => set({ doseMg: e.target.value === '' ? null : Number(e.target.value) })}
              className="pr-12"
            />
            <span className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-[14px] text-text-muted">mg</span>
          </div>
        )}
        {error?.field === 'doseMg' && <FieldError>{error.message}</FieldError>}
      </fieldset>

      <div>
        <Label htmlFor="administeredAt">투여 일시</Label>
        <Input
          id="administeredAt"
          type="datetime-local"
          value={draft.administeredAt}
          max={toDateTimeLocalValue(new Date())}
          aria-invalid={error?.field === 'administeredAt'}
          onChange={(e) => set({ administeredAt: e.target.value })}
        />
        {error?.field === 'administeredAt' && <FieldError>{error.message}</FieldError>}
      </div>

      <fieldset>
        <Label asChild>
          <legend>
            주사 부위{lastSite && <span className="text-text-subtle"> · 지난번: {siteLabel(lastSite)}</span>}
          </legend>
        </Label>
        <ChipGroup
          label="주사 부위 선택"
          columns={4}
          options={INJECTION_SITES}
          value={draft.site}
          onChange={(v) => set({ site: v })}
        />
        {error?.field === 'site' && <FieldError>{error.message}</FieldError>}
      </fieldset>

      <div>
        <Label htmlFor="memo">메모 (선택)</Label>
        <Input id="memo" placeholder="예: 저녁 식사 후" value={draft.memo} maxLength={100} onChange={(e) => set({ memo: e.target.value })} />
      </div>

      <div className="space-y-2">
        <Button type="submit" size="lg" className="w-full" disabled={submitting}>
          {submitting ? '저장 중…' : submitLabel}
        </Button>
        {extraActions}
        <p className="text-[12px] leading-relaxed text-text-subtle">
          용량은 처방받은 내용을 그대로 입력합니다. 앱은 용량을 추천하지 않습니다.
        </p>
      </div>
    </form>
  )
}

function FieldError({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="mt-1.5 text-[13px] font-medium text-danger">
      {children}
    </p>
  )
}
