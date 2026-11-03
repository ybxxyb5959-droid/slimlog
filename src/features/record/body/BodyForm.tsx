import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toDateTimeLocalValue } from '@/lib/date'
import { validateBody, type BodyInput } from '@/services/body'

import { draftToBody, type BodyDraft } from './bodyDraft'

const FIELDS: { key: keyof Omit<BodyDraft, 'measuredAt'>; label: string; unit: string; optional?: boolean }[] = [
  { key: 'weightKg', label: '체중', unit: 'kg' },
  { key: 'skeletalMuscleKg', label: '골격근량', unit: 'kg', optional: true },
  { key: 'bodyFatKg', label: '체지방량', unit: 'kg', optional: true },
  { key: 'bodyFatPct', label: '체지방률', unit: '%', optional: true },
]

export function BodyForm({
  draft,
  onChange,
  onSubmit,
  submitLabel,
  extraActions,
}: {
  draft: BodyDraft
  onChange: (d: BodyDraft) => void
  onSubmit: (input: BodyInput) => Promise<void>
  submitLabel: string
  extraActions?: React.ReactNode
}) {
  const [error, setError] = useState<{ field: string; message: string } | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const set = (patch: Partial<BodyDraft>) => {
    setError(null)
    onChange({ ...draft, ...patch })
  }

  return (
    <form
      noValidate
      className="space-y-5"
      onSubmit={async (e) => {
        e.preventDefault()
        if (submitting) return
        const input = draftToBody(draft)
        const err = validateBody(input)
        if (err) return setError(err)
        setSubmitting(true)
        try {
          await onSubmit(input)
        } finally {
          setSubmitting(false)
        }
      }}
    >
      <div>
        <Label htmlFor="measuredAt">측정 날짜 · 시간</Label>
        <Input id="measuredAt" type="datetime-local" value={draft.measuredAt} max={toDateTimeLocalValue(new Date())} onChange={(e) => set({ measuredAt: e.target.value })} />
        {error?.field === 'measuredAt' && <p role="alert" className="mt-1.5 text-[13px] text-danger">{error.message}</p>}
      </div>
      {FIELDS.map((f) => (
        <div key={f.key}>
          <Label htmlFor={`body-${f.key}`}>
            {f.label}
            {f.optional && <span className="text-text-subtle"> (선택)</span>}
          </Label>
          <div className="flex items-center gap-3">
            <Input
              id={`body-${f.key}`}
              inputMode="decimal"
              value={draft[f.key]}
              aria-invalid={error?.field === f.key}
              onChange={(e) => set({ [f.key]: e.target.value } as Partial<BodyDraft>)}
              className="tabular flex-1"
            />
            <span className="w-6 text-[14px] font-semibold text-text-muted">{f.unit}</span>
          </div>
          {error?.field === f.key && <p role="alert" className="mt-1.5 text-[13px] text-danger">{error.message}</p>}
        </div>
      ))}
      <div className="space-y-2 pt-1">
        <Button type="submit" size="lg" className="w-full" disabled={submitting}>
          {submitting ? '저장 중…' : submitLabel}
        </Button>
        {extraActions}
        <p className="text-[12px] leading-relaxed text-text-subtle">체성분은 인바디 결과지에 있는 값만 입력해 주세요. 앱이 계산해서 채우지 않아요.</p>
      </div>
    </form>
  )
}
