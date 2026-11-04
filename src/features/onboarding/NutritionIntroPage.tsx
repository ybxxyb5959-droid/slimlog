import { Calculator, CircleCheck } from 'lucide-react'
import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router'

import { Logo } from '@/components/brand/Logo'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/stores/authStore'

import { NutritionGoalSheet } from '../goals/NutritionGoalSheet'

const POINTS = ['AI 식단에서 목표 대비 섭취량 확인', '언제든 직접 수정 가능', '나중에 설정해도 괜찮아요']

const seenKey = (uid: string | null) => `slimlog:nutrition-intro:${uid ?? 'guest'}`
/** 가입 직후 한 번만 보여 준다 (기기별) */
function nutritionIntroSeen(uid: string | null) {
  try {
    return localStorage.getItem(seenKey(uid)) === '1'
  } catch {
    return false
  }
}
function markSeen(uid: string | null) {
  try {
    localStorage.setItem(seenKey(uid), '1')
  } catch {
    /* 저장이 막혀도 진행에는 문제 없음 */
  }
}

/**
 * /onboarding/nutrition-goal — 가입을 마친 직후 딱 한 번, 하루 영양 목표 설정을 '선택'으로 제안.
 * 가입 단계(4단계)에는 넣지 않아 가입이 길어지지 않게 한다. 나중엔 AI 식단 상단·마이 > 기록 목표에서 설정·수정.
 */
export function NutritionIntroPage() {
  const navigate = useNavigate()
  const uid = useAuthStore((s) => s.account?.userId ?? null)
  const [open, setOpen] = useState(false)
  const [already] = useState(() => nutritionIntroSeen(uid))
  const done = () => {
    markSeen(uid)
    navigate('/home', { replace: true })
  }
  if (already) return <Navigate to="/home" replace />
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <div className="mx-auto flex w-full max-w-[480px] flex-1 flex-col px-5 pt-[max(1rem,var(--sat))] pb-[max(1.5rem,var(--sab))]">
        <div className="flex items-center justify-between py-2">
          <Logo size={24} />
          <span className="rounded-full bg-surface-muted px-3 py-1 text-[12px] font-semibold text-text-muted">선택 설정</span>
        </div>
        <div className="flex-1 pt-8">
          <span aria-hidden className="inline-flex size-16 items-center justify-center rounded-3xl bg-icon-soft text-icon">
            <Calculator size={30} strokeWidth={1.75} />
          </span>
          <h1 className="mt-6 text-[26px] leading-[1.3] font-bold tracking-tight break-keep">하루 영양 목표를 설정할까요?</h1>
          <p className="mt-3 text-[15px] leading-relaxed break-keep text-text-muted">
            입력한 신체 정보를 바탕으로 하루 열량과
            <br />
            탄수화물·단백질·지방의 참고 목표를 계산할 수 있어요.
          </p>
          <ul className="mt-6 space-y-3 rounded-3xl border border-border bg-surface px-5 py-5">
            {POINTS.map((p) => (
              <li key={p} className="flex items-center gap-3 text-[15px]">
                <CircleCheck size={20} strokeWidth={1.9} aria-hidden className="shrink-0 text-primary" />
                {p}
              </li>
            ))}
          </ul>
        </div>
        <div className="space-y-1 pt-6">
          <Button size="lg" className="h-[52px] w-full" onClick={() => setOpen(true)}>
            참고 목표 계산하기
          </Button>
          <Button variant="ghost" size="lg" className="w-full text-text-muted" onClick={done}>
            지금은 건너뛰기
          </Button>
        </div>
      </div>
      <NutritionGoalSheet
        open={open}
        onClose={() => {
          setOpen(false)
          done()
        }}
        onManual={() => {
          markSeen(uid)
          navigate('/my/goals', { replace: true })
        }}
      />
    </div>
  )
}
