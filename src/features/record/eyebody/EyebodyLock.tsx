import { Fingerprint, KeyRound, LockKeyhole, ShieldCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { AppIcon } from '@/components/common/AppIcon'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { Notice } from '@/components/common/Notice'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { biometric } from '@/lib/biometric'
import {
  changePassword,
  confirmRecoverySaved,
  createVault,
  disableBiometric,
  enableBiometric,
  LOCAL_ONLY_NOTICE,
  regenerateRecoveryCode,
  setNewPassword,
  unlock,
  unlockWithBiometric,
  unlockWithRecovery,
  vaultInfo,
  wipeVault,
  type VaultInfo,
} from '@/lib/eyebodyVault'

function useBioAvailable() {
  const [ok, setOk] = useState(false)
  useEffect(() => {
    biometric.available().then((r) => setOk(r.ok))
  }, [])
  return ok
}

/** 비밀번호 두 칸 (새로 정할 때) */
function NewPasswordFields({ busy, submitLabel, onSubmit }: { busy: boolean; submitLabel: string; onSubmit: (pw: string) => Promise<void> }) {
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [error, setError] = useState<string | null>(null)
  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault()
        if (pw !== pw2) return setError('비밀번호가 서로 달라요.')
        setError(null)
        try {
          await onSubmit(pw)
        } catch (err) {
          setError((err as Error).message)
        }
      }}
    >
      <div>
        <Label htmlFor="newVaultPw">새 비밀번호 (6자 이상)</Label>
        <Input id="newVaultPw" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
      </div>
      <div>
        <Label htmlFor="newVaultPw2">새 비밀번호 확인</Label>
        <Input id="newVaultPw2" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
      </div>
      {error && (
        <p role="alert" className="text-[13px] text-danger">
          {error}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={busy || pw.length < 6}>
        {busy ? '저장 중…' : submitLabel}
      </Button>
    </form>
  )
}

/** 복구 코드 보여 주기 — 한 번만 보여 주고 저장하지 않는다 */
export function RecoveryCodeView({ code, reason, migrated, onDone }: { code: string; reason: 'new' | 'migrated' | 'regenerated'; migrated?: { moved: number; total: number }; onDone: () => void }) {
  const [saved, setSaved] = useState(false)
  return (
    <Card className="space-y-4 md:max-w-md">
      <div className="flex items-center gap-3">
        <AppIcon icon={KeyRound} bg="soft" />
        <div>
          <p className="text-[16px] font-bold">복구 코드를 적어 두세요</p>
          <p className="text-[13px] text-text-muted">비밀번호를 잊었을 때 이 코드로 다시 열 수 있어요.</p>
        </div>
      </div>
      {reason === 'migrated' && (
        <Notice tone="info" title="보안 방식이 새로워졌어요">
          예전 사진 {migrated?.moved ?? 0}장을 새 방식으로 옮기고, 하나씩 다시 열어 똑같은지 확인했어요. 그래서 복구 코드가 새로 생겼어요.
        </Notice>
      )}
      {reason === 'regenerated' && <Notice tone="review" title="예전 복구 코드는 이제 쓸 수 없어요">아래 새 코드를 적어 두세요.</Notice>}
      <div className="rounded-2xl bg-surface-muted px-3 py-4">
        {/* 읽기 프로그램·복사용 전체 값 */}
        <p aria-label="복구 코드" className="sr-only select-all">
          {code}
        </p>
        <div aria-hidden className="grid grid-cols-3 gap-x-2 gap-y-2 text-center font-mono text-[19px] font-bold tracking-wider">
          {code.split('-').map((g, i) => (
            <span key={i} className="tabular rounded-lg bg-surface py-1.5">
              {g}
            </span>
          ))}
        </div>
      </div>
      <ul className="space-y-1 text-[13px] leading-relaxed text-text-muted">
        <li>· 종이에 적어 두거나 비밀번호 관리 앱에 저장하세요.</li>
        <li>· 스크린샷·메신저·클라우드 메모에는 남기지 마세요. 누가 보면 사진을 열 수 있어요.</li>
        <li>· 이 화면을 닫으면 다시 볼 수 없어요. 잃어버리면 설정에서 새로 만들 수 있어요.</li>
      </ul>
      <label className="flex min-h-11 cursor-pointer items-center gap-3 text-[14px] font-medium">
        <input type="checkbox" className="size-5 accent-[var(--primary)]" checked={saved} onChange={(e) => setSaved(e.target.checked)} />
        안전한 곳에 적어 뒀어요
      </label>
      <Button
        className="w-full"
        disabled={!saved}
        onClick={async () => {
          await confirmRecoverySaved()
          onDone()
        }}
      >
        확인
      </Button>
    </Card>
  )
}

type GateStep = { s: 'form' } | { s: 'code'; code: string; reason: 'new' | 'migrated'; migrated?: { moved: number; total: number } } | { s: 'forgot' } | { s: 'recover' } | { s: 'newpw' }

/** 잠금 화면 — 만들기 / 열기 / 비밀번호 잊었어요(지문·복구 코드·전부 지우기) */
export function PasswordGate({ mode, onDone }: { mode: 'new' | 'locked'; onDone: () => void }) {
  const [step, setStep] = useState<GateStep>({ s: 'form' })
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [wipe, setWipe] = useState(false)
  const [info, setInfo] = useState<VaultInfo | null>(null)
  const bioOk = useBioAvailable()
  useEffect(() => {
    if (mode === 'locked') vaultInfo().then(setInfo)
  }, [mode])
  const canBio = bioOk && !!info?.bio

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    setError(null)
    try {
      await fn()
    } catch (err) {
      setError((err as Error).message || '처리하지 못했어요. 다시 시도해 주세요.')
    } finally {
      setBusy(false)
      setProgress(null)
    }
  }

  if (step.s === 'code') return <RecoveryCodeView code={step.code} reason={step.reason} migrated={step.migrated} onDone={onDone} />

  return (
    <Card className="space-y-4 md:max-w-md">
      <div className="flex items-center gap-3">
        <AppIcon icon={LockKeyhole} bg="soft" />
        <div>
          <p className="text-[16px] font-bold">
            {mode === 'new' ? '눈바디 비밀번호 만들기' : step.s === 'form' ? '눈바디 잠금 해제' : step.s === 'newpw' ? '새 비밀번호 정하기' : '비밀번호를 잊었어요'}
          </p>
          <p className="text-[13px] text-text-muted">사진은 암호화돼서 이 기기에만 저장돼요.</p>
        </div>
      </div>

      {step.s === 'form' && (
        <>
          {mode === 'new' && (
            <Notice tone="review" title="처음 쓰기 전에 꼭 읽어 주세요">
              {LOCAL_ONLY_NOTICE}. 비밀번호는 서버에도 저장되지 않아요. 다음 화면의 복구 코드를 꼭 적어 두세요.
            </Notice>
          )}
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault()
              if (mode === 'new' && pw !== pw2) return setError('비밀번호가 서로 달라요.')
              void run(async () => {
                if (mode === 'new') {
                  const { recoveryCode } = await createVault(pw)
                  setStep({ s: 'code', code: recoveryCode, reason: 'new' })
                } else {
                  const r = await unlock(pw, (d, t) => setProgress(`예전 사진을 새 방식으로 옮기는 중 (${d}/${t})`))
                  if (r.recoveryCode) setStep({ s: 'code', code: r.recoveryCode, reason: 'migrated', migrated: r.migrated })
                  else onDone()
                }
              })
            }}
          >
            <div>
              <Label htmlFor="vaultPw">비밀번호 (6자 이상)</Label>
              <Input id="vaultPw" type="password" autoComplete={mode === 'new' ? 'new-password' : 'current-password'} value={pw} onChange={(e) => setPw(e.target.value)} />
            </div>
            {mode === 'new' && (
              <div>
                <Label htmlFor="vaultPw2">비밀번호 확인</Label>
                <Input id="vaultPw2" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
              </div>
            )}
            {error && (
              <p role="alert" className="text-[13px] text-danger">
                {error}
              </p>
            )}
            {progress && (
              <p role="status" className="text-[13px] text-text-muted">
                {progress}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={busy || pw.length < 6}>
              {busy ? '확인 중…' : mode === 'new' ? '만들기' : '잠금 해제'}
            </Button>
          </form>
          {mode === 'locked' && canBio && (
            <Button variant="outline" className="w-full" disabled={busy} onClick={() => run(async () => (await unlockWithBiometric(), onDone()))}>
              <Fingerprint size={18} aria-hidden /> 지문으로 열기
            </Button>
          )}
          {mode === 'locked' && (
            <button
              type="button"
              className="text-[13px] text-text-muted underline-offset-2 hover:underline"
              onClick={() => {
                setError(null)
                setStep({ s: 'forgot' })
              }}
            >
              비밀번호를 잊었어요
            </button>
          )}
        </>
      )}

      {step.s === 'forgot' && (
        <div className="space-y-2">
          {canBio && (
            <Button variant="outline" className="w-full justify-start" disabled={busy} onClick={() => run(async () => (await unlockWithBiometric(true), setStep({ s: 'newpw' })))}>
              <Fingerprint size={18} aria-hidden /> 지문으로 열고 새 비밀번호 정하기
            </Button>
          )}
          <Button variant="outline" className="w-full justify-start" onClick={() => (setError(null), setStep({ s: 'recover' }))}>
            <KeyRound size={18} aria-hidden /> 복구 코드로 열고 새 비밀번호 정하기
          </Button>
          <button type="button" onClick={() => setWipe(true)} className="w-full rounded-xl px-4 py-2.5 text-left text-danger hover:bg-danger-soft">
            <span className="block text-[14px] font-semibold">둘 다 없어요</span>
            <span className="block text-[12px]">사진을 전부 지우고 새로 시작해요</span>
          </button>
          {error && (
            <p role="alert" className="text-[13px] text-danger">
              {error}
            </p>
          )}
          <button type="button" className="text-[13px] text-text-muted underline-offset-2 hover:underline" onClick={() => setStep({ s: 'form' })}>
            비밀번호 입력으로 돌아가기
          </button>
        </div>
      )}

      {step.s === 'recover' && (
        <form className="space-y-3" onSubmit={(e) => (e.preventDefault(), void run(async () => (await unlockWithRecovery(code), setStep({ s: 'newpw' }))))}>
          <div>
            <Label htmlFor="recoveryCode">복구 코드 (24자리)</Label>
            <Input id="recoveryCode" autoComplete="off" autoCapitalize="characters" spellCheck={false} placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX" value={code} onChange={(e) => setCode(e.target.value)} className="font-mono" />
          </div>
          {error && (
            <p role="alert" className="text-[13px] text-danger">
              {error}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={busy || code.replace(/[^0-9a-z]/gi, '').length < 24}>
            {busy ? '확인 중…' : '복구 코드로 열기'}
          </Button>
          <button type="button" className="text-[13px] text-text-muted underline-offset-2 hover:underline" onClick={() => setStep({ s: 'forgot' })}>
            뒤로
          </button>
        </form>
      )}

      {step.s === 'newpw' && (
        <>
          <Notice tone="info" title="열렸어요">
            앞으로 쓸 새 비밀번호를 정해 주세요. 복구 코드는 그대로 쓸 수 있어요.
          </Notice>
          <NewPasswordFields
            busy={busy}
            submitLabel="새 비밀번호로 저장"
            onSubmit={async (p) => {
              setBusy(true)
              try {
                await setNewPassword(p)
                toast.success('새 비밀번호로 바꿨어요')
                onDone()
              } finally {
                setBusy(false)
              }
            }}
          />
        </>
      )}

      <ConfirmDialog
        open={wipe}
        onOpenChange={setWipe}
        title="눈바디 사진을 전부 지울까요?"
        description="비밀번호·지문·복구 코드 없이는 사진을 열 수 없어서, 새로 시작하려면 이 기기의 눈바디 사진을 모두 지워야 해요. 되돌릴 수 없어요."
        confirmLabel="전부 지우기"
        tone="danger"
        onConfirm={async () => {
          await wipeVault()
          toast('눈바디 사진을 지웠어요')
          onDone()
        }}
      />
    </Card>
  )
}

type SecStep = 'menu' | 'bio' | 'password' | 'recovery'

/** 눈바디 설정 안의 보안 메뉴 — 지문 잠금 · 비밀번호 변경 · 복구 코드 새로 만들기 */
export function SecuritySettings() {
  const [step, setStep] = useState<SecStep>('menu')
  const [info, setInfo] = useState<VaultInfo | null>(null)
  const [pw, setPw] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [newCode, setNewCode] = useState<string | null>(null)
  const bioOk = useBioAvailable()
  const refresh = () => vaultInfo().then(setInfo)
  useEffect(() => {
    void refresh()
  }, [])
  const back = () => {
    setStep('menu')
    setPw('')
    setError(null)
  }

  if (newCode) return <RecoveryCodeView code={newCode} reason="regenerated" onDone={() => (setNewCode(null), back(), void refresh())} />

  if (step === 'menu')
    return (
      <div className="space-y-2">
        {info && !info.rcConfirmed && (
          <Notice tone="review" title="복구 코드를 아직 확인하지 않았어요">
            비밀번호를 잊으면 사진을 못 열 수 있어요. 아래에서 새로 만들어 적어 두세요.
          </Notice>
        )}
        {info?.migration === 'pending' && <Notice tone="review" title="예전 사진 옮기는 중">비밀번호로 한 번 더 열면 남은 {info.legacyLeft}장을 마저 옮겨요.</Notice>}
        <div className="flex min-h-14 items-center gap-3 rounded-2xl border border-border px-4">
          <Fingerprint size={20} aria-hidden className="text-icon" />
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-medium">지문 잠금</span>
            <span className="block text-[12px] text-text-muted">{bioOk ? '지문을 새로 등록하면 다시 켜야 해요' : '갤럭시 앱에서만 쓸 수 있어요'}</span>
          </span>
          <Switch
            aria-label="지문 잠금"
            checked={!!info?.bio}
            disabled={!bioOk}
            onCheckedChange={async (on) => {
              if (on) return setStep('bio')
              await disableBiometric()
              await refresh()
              toast('지문 잠금을 껐어요')
            }}
          />
        </div>
        <Button variant="outline" className="w-full justify-start" disabled={info?.migration === 'pending'} onClick={() => setStep('password')}>
          <LockKeyhole size={16} aria-hidden /> 비밀번호 변경
        </Button>
        <Button variant="outline" className="w-full justify-start" onClick={() => setStep('recovery')}>
          <ShieldCheck size={16} aria-hidden /> 복구 코드 새로 만들기
        </Button>
      </div>
    )

  if (step === 'password')
    return (
      <div className="space-y-3">
        <div>
          <Label htmlFor="curVaultPw">지금 비밀번호</Label>
          <Input id="curVaultPw" type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} />
        </div>
        <NewPasswordFields
          busy={busy}
          submitLabel="비밀번호 변경"
          onSubmit={async (p) => {
            setBusy(true)
            try {
              await changePassword(pw, p)
              toast.success('비밀번호를 바꿨어요')
              back()
            } finally {
              setBusy(false)
            }
          }}
        />
        <Button variant="ghost" className="w-full" onClick={back}>
          취소
        </Button>
      </div>
    )

  // bio · recovery: 지금 비밀번호로 확인
  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault()
        setBusy(true)
        setError(null)
        try {
          if (step === 'bio') {
            await enableBiometric(pw)
            toast.success('지문 잠금을 켰어요')
            back()
            await refresh()
          } else setNewCode(await regenerateRecoveryCode(pw))
        } catch (err) {
          setError((err as Error).message)
        } finally {
          setBusy(false)
        }
      }}
    >
      <p className="text-[14px] font-medium">{step === 'bio' ? '지문 잠금을 켜려면 비밀번호를 한 번 더 입력해 주세요' : '복구 코드를 새로 만들면 예전 코드는 바로 못 써요'}</p>
      <div>
        <Label htmlFor="confirmVaultPw">비밀번호</Label>
        <Input id="confirmVaultPw" type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} />
      </div>
      {error && (
        <p role="alert" className="text-[13px] text-danger">
          {error}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={busy || pw.length < 6}>
        {busy ? '확인 중…' : step === 'bio' ? '지문 잠금 켜기' : '새 복구 코드 만들기'}
      </Button>
      <Button type="button" variant="ghost" className="w-full" onClick={back}>
        취소
      </Button>
    </form>
  )
}
