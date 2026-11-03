import { RefreshCw, UserRound } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'

import { AppIcon } from '@/components/common/AppIcon'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { validateNickname } from '@/lib/nickname'
import { cn } from '@/lib/utils'
import { checkNicknameAvailability, reserveNickname, suggestNickname } from '@/services/nickname'
import { useOnboardingStore } from '@/stores/onboardingStore'

import { NicknameStatus, type NicknameState } from './NicknameStatus'
import { OnboardingShell } from './OnboardingShell'

export function NicknameStep() {
  const navigate = useNavigate()
  const { nickname, set } = useOnboardingStore()
  // 처음 들어오면 자동 닉네임 생성 (이미 있으면 그대로)
  const [value, setValue] = useState(() => nickname || suggestNickname())
  const [state, setState] = useState<NicknameState>({ kind: 'idle' })
  const [saving, setSaving] = useState(false)
  const [suggestions, setSuggestions] = useState<string[]>([])
  /** 마지막으로 '사용 가능' 판정을 받은 값 — 입력이 바뀌면 다시 확인해야 한다 */
  const [checkedName, setCheckedName] = useState<string | null>(null)
  const abort = useRef<AbortController | null>(null)
  const timer = useRef<number | undefined>(undefined)

  const check = useCallback(async (name: string) => {
    abort.current?.abort()
    const invalid = validateNickname(name)
    if (invalid) return setState({ kind: 'invalid', message: invalid })
    const ctrl = new AbortController()
    abort.current = ctrl
    setState({ kind: 'checking' })
    try {
      const r = await checkNicknameAvailability(name.trim(), ctrl.signal)
      if (ctrl.signal.aborted) return
      setState({ kind: r })
      setCheckedName(r === 'available' ? name.trim() : null)
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setState({ kind: 'error' })
    }
  }, [])

  const change = (name: string, immediate = false) => {
    // 진행 중인 확인은 버린다 (늦게 온 이전 결과가 새 상태를 덮어쓰지 않게)
    abort.current?.abort()
    setCheckedName(null)
    setValue(name)
    set({ nickname: name, nicknameSaved: false })
    setSuggestions([])
    window.clearTimeout(timer.current)
    if (immediate) return void check(name)
    setState({ kind: 'typing' })
    timer.current = window.setTimeout(() => check(name), 450)
  }

  // 생성한 닉네임을 저장하고 사용 가능 여부 확인
  useEffect(() => {
    if (!nickname) set({ nickname: value })
    timer.current = window.setTimeout(() => check(value), 0)
    return () => {
      abort.current?.abort()
      window.clearTimeout(timer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const submit = async () => {
    abort.current?.abort()
    window.clearTimeout(timer.current)
    setSaving(true)
    const r = await reserveNickname(value.trim())
    setSaving(false)
    if (r.ok) {
      set({ nickname: value.trim(), nicknameSaved: true, step: 'body' })
      navigate('/onboarding/body')
    } else {
      setState({ kind: 'taken-on-save' })
      setCheckedName(null)
      setSuggestions(r.suggestions)
    }
  }

  const ready = state.kind === 'available' && checkedName === value.trim()

  return (
    <OnboardingShell
      step={1}
      title={
        <>
          반가워요!
          <br />
          어떻게 불러드릴까요?
        </>
      }
      description="나만의 닉네임을 준비했어요. 마음에 들지 않으면 바꿀 수 있어요."
      footer={
        <Button size="lg" className="h-[52px] w-full" disabled={!ready || saving} onClick={submit}>
          {saving ? '닉네임 저장 중…' : '이 닉네임으로 계속하기'}
        </Button>
      }
    >
      <div className="rounded-3xl border border-border bg-surface p-5">
        <div className="flex justify-center">
          <AppIcon icon={UserRound} size="lg" bg="success" tone="success" className="size-16 rounded-full [&>svg]:size-7" />
        </div>
        <label htmlFor="nickname" className="mt-5 mb-2 block text-[13px] font-medium text-text-muted">
          나의 닉네임
        </label>
        <Input
          id="nickname"
          value={value}
          maxLength={10}
          autoComplete="off"
          enterKeyHint="done"
          aria-invalid={state.kind === 'invalid' || state.kind === 'duplicate' || state.kind === 'taken-on-save'}
          aria-describedby="nickname-status"
          onChange={(e) => change(e.target.value)}
          onFocus={(e) => e.currentTarget.scrollIntoView({ block: 'center', behavior: 'smooth' })}
          className={cn('h-13 rounded-2xl text-[17px] font-semibold', state.kind === 'available' && 'border-primary')}
        />
        <Button
          variant="outline"
          className="mt-3 h-12 w-full rounded-2xl"
          onClick={() => change(suggestNickname([value]), true)}
          disabled={saving}
        >
          <RefreshCw size={18} strokeWidth={1.75} aria-hidden /> 다른 닉네임 추천
        </Button>
        <div id="nickname-status" className="mt-3 min-h-10">
          <NicknameStatus state={state} />
        </div>
        {state.kind === 'error' && (
          <Button variant="secondary" size="sm" onClick={() => check(value)}>
            다시 확인
          </Button>
        )}
        {suggestions.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2" aria-label="추천 닉네임">
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => change(s, true)}
                className="h-10 rounded-full border border-border bg-surface px-4 text-[14px] font-medium hover:bg-surface-muted"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 rounded-2xl bg-primary-soft px-5 py-4">
        <p className="text-[15px] font-semibold text-primary">내 기록은 나만 볼 수 있어요</p>
        <p className="mt-1 text-[13px] leading-relaxed text-text-muted">커뮤니티에는 닉네임만 공개돼요. 이메일과 건강 정보는 공개되지 않아요.</p>
      </div>
    </OnboardingShell>
  )
}
