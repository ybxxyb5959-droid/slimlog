import { Moon, Smartphone, Sun } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { PageHeader } from '@/components/common/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { getThemePref, setThemePref, type ThemePref } from '@/lib/theme'
import { cn } from '@/lib/utils'
import { ANALYSIS_PK_NOTICE, localNoticeRepository } from '@/stores/noticePreferences'

import { MyGroup, SettingRow } from './MyRow'

const THEMES: { v: ThemePref; label: string; icon: typeof Sun }[] = [
  { v: 'system', label: '폰 설정', icon: Smartphone },
  { v: 'light', label: '밝게', icon: Sun },
  { v: 'dark', label: '어둡게', icon: Moon },
]

export function AppSettingsPage() {
  const [theme, setTheme] = useState<ThemePref>(getThemePref)
  return (
    <>
      <PageHeader title="화면 및 앱 환경" back="/my/settings" />
      <div className="space-y-6 md:max-w-2xl">
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
      </div>
    </>
  )
}
