import { useState } from 'react'

import { PageHeader } from '@/components/common/PageHeader'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { formatMl, summarizeIntake, useIntakeStore } from '@/stores/intakeStore'

import { IntakeSheet } from './IntakeSheet'

/** /record/daily — 섭취 관리(물·영양제·복용약). 홈 카드와 같은 시트를 쓴다 */
export function IntakePage() {
  const [open, setOpen] = useState(true)
  const water = useIntakeStore((s) => s.water)
  const logs = useIntakeStore((s) => s.logs)
  const goal = useIntakeStore((s) => s.waterGoalMl)
  const t = summarizeIntake({ water, logs })
  return (
    <>
      <PageHeader title="섭취 관리" description="물 · 영양제 · 복용약" back="/record" />
      <Card className="space-y-3 md:max-w-lg">
        <p className="tabular text-[15px]">
          오늘 물 <b>{formatMl(t.ml)}</b> / 목표 {formatMl(goal)} · 복용 <b>{t.taken}건</b>
        </p>
        <Button className="w-full" onClick={() => setOpen(true)}>
          기록하기
        </Button>
      </Card>
      <IntakeSheet open={open} onClose={() => setOpen(false)} />
    </>
  )
}
