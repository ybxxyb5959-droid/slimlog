import { Moon, Smartphone, Sun } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { PageHeader } from '@/components/common/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { dbErrorMessage, isLive } from '@/lib/supabase'
import { getThemePref, setThemePref, type ThemePref } from '@/lib/theme'
import { cn } from '@/lib/utils'
import { parseGoals, saveGoals } from '@/services/goals'
import { ML_PER_CUP, useIntakeStore } from '@/stores/intakeStore'
import { ANALYSIS_PK_NOTICE, localNoticeRepository } from '@/stores/noticePreferences'

import { MyGroup, SettingRow } from './MyRow'

const THEMES: { v: ThemePref; label: string; icon: typeof Sun }[] = [
  { v: 'system', label: '폰 설정', icon: Smartphone },
  { v: 'light', label: '밝게', icon: Sun },
  { v: 'dark', label: '어둡게', icon: Moon },
]

export function AppSettingsPage() {
  const [theme, setTheme] = useState<ThemePref>(getThemePref)
  const savedProtein = useIntakeStore((s) => s.proteinGoalG)
  const savedWaterMl = useIntakeStore((s) => s.waterGoalMl)
  const [protein, setProtein] = useState(savedProtein === null ? '' : String(savedProtein))
  const [water, setWater] = useState(String(Math.round(savedWaterMl / ML_PER_CUP)))
  const [saving, setSaving] = useState(false)
  const parsed = parseGoals({ proteinG: protein, waterCups: water })
  const err = parsed.error
  const changed = parsed.value && (parsed.value.proteinG !== savedProtein || parsed.value.waterCups * ML_PER_CUP !== savedWaterMl)
  return (
    <>
      <PageHeader title="화면 및 앱 환경" back="/my/settings" />
      <div className="space-y-6 md:max-w-2xl">
        <MyGroup title="기록 목표">
          <SettingRow id="proteinGoal" label="하루 단백질 목표" description="식단 분석의 단백질 그래프에 목표선으로 보여요. 비우면 목표 없음">
            <div className="relative w-28">
              <Input id="proteinGoal" type="number" inputMode="numeric" min={0} max={400} placeholder="없음" aria-invalid={err?.field === 'proteinG'} aria-describedby={err?.field === 'proteinG' ? 'goalError' : undefined} value={protein} onChange={(e) => setProtein(e.target.value)} className="h-11 pr-8 text-right" />
              <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[13px] text-text-muted">g</span>
            </div>
          </SettingRow>
          <SettingRow id="waterGoal" label="하루 물 목표" description="1컵 = 250ml">
            <div className="relative w-28">
              <Input id="waterGoal" type="number" inputMode="numeric" min={1} max={24} aria-invalid={err?.field === 'waterCups'} aria-describedby={err?.field === 'waterCups' ? 'goalError' : undefined} value={water} onChange={(e) => setWater(e.target.value)} className="h-11 pr-8 text-right" />
              <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[13px] text-text-muted">컵</span>
            </div>
          </SettingRow>
        </MyGroup>
        {err && (
          <p id="goalError" role="alert" className="-mt-3 px-1 text-[13px] text-danger">
            {err.message}
          </p>
        )}
        <p className="-mt-3 px-1 text-[12px] text-text-subtle">목표는 직접 정하는 값이에요. 앱이 목표 섭취량을 추천하지 않아요.</p>
        <MyGroup title="화면">
          <div className="space-y-2.5 px-5 py-3.5">
            <div>
              <span id="themeLabel" className="block text-[15px] text-text">
                화면 밝기
              </span>
              <span className="mt-0.5 block text-[12px] leading-relaxed text-text-muted">누르면 바로 바뀌어요. 이 기기에만 저장돼요</span>
            </div>
            <div role="radiogroup" aria-labelledby="themeLabel" className="grid grid-cols-3 gap-1 rounded-full bg-surface-muted p-1">
              {THEMES.map((t) => (
                <button
                  key={t.v}
                  type="button"
                  role="radio"
                  aria-checked={theme === t.v}
                  onClick={() => {
                    setTheme(t.v)
                    setThemePref(t.v)
                  }}
                  className={cn('flex h-10 items-center justify-center gap-1.5 rounded-full text-[14px] font-medium', theme === t.v ? 'bg-surface font-semibold text-text shadow-[0_1px_2px_rgba(15,23,42,0.08)]' : 'text-text-muted')}
                >
                  <t.icon size={16} aria-hidden />
                  {t.label}
                </button>
              ))}
            </div>
          </div>
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
        <Button
          size="lg"
          className="w-full"
          disabled={!!err || !changed || saving}
          onClick={async () => {
            if (!parsed.value) return
            setSaving(true)
            try {
              await saveGoals(parsed.value)
              toast.success(isLive ? '목표를 저장했어요' : '목업: 화면에만 저장됐어요')
            } catch (e) {
              toast.error('저장하지 못했어요', { description: dbErrorMessage(e) })
            } finally {
              setSaving(false)
            }
          }}
        >
          {saving ? '저장 중…' : '저장'}
        </Button>
      </div>
    </>
  )
}
