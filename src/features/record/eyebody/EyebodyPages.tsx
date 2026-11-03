import { Camera, Image as ImageIcon, LockKeyhole, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { toast } from 'sonner'

import { AppIcon } from '@/components/common/AppIcon'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { Notice } from '@/components/common/Notice'
import { PageHeader } from '@/components/common/PageHeader'
import { EmptyState, LoadingState } from '@/components/common/StateViews'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatShortDateWithDay, toDateKey } from '@/lib/date'
import { addPhoto, createVault, listPhotos, lock, photoUrl, removePhoto, setVaultUser, unlock, vaultState, wipeVault, type PhotoMeta } from '@/lib/eyebodyVault'
import { useBodyLogs } from '@/services/body'
import { useAuthStore } from '@/stores/authStore'

const dayLabel = (k: string) => formatShortDateWithDay(new Date(`${k}T12:00:00`))

/** 복호화한 썸네일/원본 — 화면을 떠나면 임시 주소를 지운다 */
function VaultImage({ id, thumb, alt, className }: { id: string; thumb?: boolean; alt: string; className?: string }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let u: string | null = null
    let alive = true
    photoUrl(id, thumb)
      .then((x) => {
        u = x
        if (alive) setUrl(x)
        else URL.revokeObjectURL(x)
      })
      .catch(() => {})
    return () => {
      alive = false
      if (u) URL.revokeObjectURL(u)
    }
  }, [id, thumb])
  return url ? <img src={url} alt={alt} className={className} /> : <div className={`${className} animate-pulse bg-surface-muted`} aria-label={`${alt} 불러오는 중`} />
}

function useVault() {
  const uid = useAuthStore((s) => s.account?.userId ?? null)
  const [state, setState] = useState<'loading' | 'new' | 'locked' | 'unlocked'>('loading')
  const refresh = useCallback(() => {
    setVaultUser(uid)
    vaultState().then(setState).catch(() => setState('new'))
  }, [uid])
  useEffect(() => refresh(), [refresh])
  return { state, refresh }
}

function PasswordGate({ mode, onDone }: { mode: 'new' | 'locked'; onDone: () => void }) {
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [wipe, setWipe] = useState(false)
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (mode === 'new' && pw !== pw2) return setError('비밀번호가 서로 달라요.')
    setBusy(true)
    setError(null)
    try {
      if (mode === 'new') await createVault(pw)
      else await unlock(pw)
      onDone()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <Card className="space-y-4 md:max-w-md">
      <div className="flex items-center gap-3">
        <AppIcon icon={LockKeyhole} bg="soft" />
        <div>
          <p className="text-[16px] font-bold">{mode === 'new' ? '눈바디 비밀번호 만들기' : '눈바디 잠금 해제'}</p>
          <p className="text-[13px] text-text-muted">사진은 이 비밀번호로 암호화돼서 이 기기에만 저장돼요.</p>
        </div>
      </div>
      <form onSubmit={submit} className="space-y-3">
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
        {error && <p role="alert" className="text-[13px] text-danger">{error}</p>}
        <Button type="submit" className="w-full" disabled={busy || pw.length < 6}>
          {busy ? '확인 중…' : mode === 'new' ? '만들기' : '잠금 해제'}
        </Button>
      </form>
      {mode === 'new' ? (
        <Notice tone="review" title="잊으면 복구할 수 없어요">
          비밀번호는 서버에도 저장되지 않아요. 브라우저 데이터를 지우거나 기기를 바꾸면 사진이 사라져요.
        </Notice>
      ) : (
        <button type="button" className="text-[13px] text-text-muted underline-offset-2 hover:underline" onClick={() => setWipe(true)}>
          비밀번호를 잊었어요 (사진 전부 지우고 새로 시작)
        </button>
      )}
      <ConfirmDialog
        open={wipe}
        onOpenChange={setWipe}
        title="눈바디 사진을 전부 지울까요?"
        description="비밀번호 없이는 사진을 열 수 없어서, 새로 시작하려면 이 기기의 눈바디 사진을 모두 지워야 해요."
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

/** /record/eyebody — 날짜별 사진 (이 기기에만) */
export function EyebodyPage() {
  const { state, refresh } = useVault()
  const [photos, setPhotos] = useState<PhotoMeta[] | null>(null)
  const [takenAt, setTakenAt] = useState(() => toDateKey(new Date()))
  const [busy, setBusy] = useState(false)
  const [del, setDel] = useState<PhotoMeta | null>(null)
  const camera = useRef<HTMLInputElement>(null)
  const gallery = useRef<HTMLInputElement>(null)
  const weights = useBodyLogs()
  const weightOn = (k: string) => weights.filter((w) => toDateKey(new Date(w.measuredAt)) === k).at(-1)?.weightKg

  useEffect(() => {
    if (state === 'unlocked') listPhotos().then(setPhotos)
  }, [state])

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    setBusy(true)
    try {
      await addPhoto(f, takenAt)
      setPhotos(await listPhotos())
      toast.success('눈바디 사진을 저장했어요', { description: '이 기기에만 암호화해서 저장했어요.' })
    } catch (err) {
      toast.error('저장하지 못했어요', { description: (err as Error).message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader
        title="눈바디"
        description="사진은 서버로 보내지 않고 이 기기에만 저장해요"
        back="/record"
        actions={
          state === 'unlocked' ? (
            <Button
              variant="outline"
              size="sm"
              className="h-10"
              onClick={() => {
                lock()
                refresh()
              }}
            >
              잠그기
            </Button>
          ) : undefined
        }
      />
      {state === 'loading' ? (
        <LoadingState />
      ) : state !== 'unlocked' ? (
        <PasswordGate mode={state} onDone={refresh} />
      ) : (
        <div className="space-y-4 md:max-w-2xl">
          <Card className="space-y-3">
            <div>
              <Label htmlFor="eyebodyDate">찍은 날짜</Label>
              <Input id="eyebodyDate" type="date" value={takenAt} max={toDateKey(new Date())} onChange={(e) => setTakenAt(e.target.value)} />
            </div>
            <input ref={camera} type="file" accept="image/*" capture="user" className="sr-only" aria-label="눈바디 카메라" onChange={onFile} />
            <input ref={gallery} type="file" accept="image/*" className="sr-only" aria-label="눈바디 사진 선택" onChange={onFile} />
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" disabled={busy} onClick={() => camera.current?.click()}>
                <Camera size={18} strokeWidth={1.75} aria-hidden /> 촬영
              </Button>
              <Button variant="outline" disabled={busy} onClick={() => gallery.current?.click()}>
                <ImageIcon size={18} strokeWidth={1.75} aria-hidden /> 앨범에서
              </Button>
            </div>
          </Card>
          {photos === null ? (
            <LoadingState />
          ) : photos.length === 0 ? (
            <EmptyState title="아직 눈바디 사진이 없어요" description="같은 자세·같은 장소에서 찍으면 비교하기 좋아요." className="py-6" />
          ) : (
            <>
              {photos.length >= 2 && (
                <Button asChild className="w-full">
                  <Link to={`/record/eyebody/compare?a=${photos.at(-1)!.id}&b=${photos[0].id}`}>처음과 최근 비교하기</Link>
                </Button>
              )}
              <ul className="grid grid-cols-3 gap-2" aria-label="눈바디 사진 목록">
                {photos.map((p) => (
                  <li key={p.id} className="relative overflow-hidden rounded-2xl border border-border bg-surface">
                    <VaultImage id={p.id} thumb alt={`${dayLabel(p.takenAt)} 눈바디`} className="aspect-[3/4] w-full object-cover" />
                    <div className="flex items-center justify-between px-2 py-1.5">
                      <span className="tabular text-[11px] text-text-muted">
                        {p.takenAt.slice(5).replace('-', '/')}
                        {weightOn(p.takenAt) ? ` · ${weightOn(p.takenAt)!.toFixed(1)}kg` : ''}
                      </span>
                      <button type="button" aria-label={`${dayLabel(p.takenAt)} 사진 삭제`} onClick={() => setDel(p)} className="inline-flex size-7 items-center justify-center rounded-full hover:bg-surface-muted">
                        <Trash2 size={14} strokeWidth={1.75} aria-hidden />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
      <ConfirmDialog
        open={!!del}
        onOpenChange={(o) => !o && setDel(null)}
        title="이 사진을 삭제할까요?"
        description="이 기기에서 바로 지워지고 되돌릴 수 없어요."
        confirmLabel="삭제"
        tone="danger"
        onConfirm={async () => {
          if (!del) return
          await removePhoto(del.id)
          setPhotos(await listPhotos())
          setDel(null)
          toast('사진을 삭제했어요')
        }}
      />
    </>
  )
}

/** /record/eyebody/compare?a=&b= — 두 날짜 나란히 */
export function EyebodyComparePage() {
  const { state, refresh } = useVault()
  const [params, setParams] = useSearchParams()
  const [photos, setPhotos] = useState<PhotoMeta[]>([])
  const weights = useBodyLogs()
  useEffect(() => {
    if (state === 'unlocked') listPhotos().then(setPhotos)
  }, [state])
  const pick = (k: 'a' | 'b') => photos.find((p) => p.id === params.get(k)) ?? (k === 'a' ? photos.at(-1) : photos[0])
  const side = (k: 'a' | 'b') => {
    const p = pick(k)
    const w = p && weights.filter((x) => toDateKey(new Date(x.measuredAt)) === p.takenAt).at(-1)?.weightKg
    return (
      <div className="min-w-0 flex-1 space-y-2">
        <select
          aria-label={k === 'a' ? '왼쪽 사진 날짜' : '오른쪽 사진 날짜'}
          className="h-10 w-full rounded-xl border border-border bg-surface px-2 text-[13px]"
          value={p?.id ?? ''}
          onChange={(e) => setParams((prev) => ({ ...Object.fromEntries(prev), [k]: e.target.value }), { replace: true })}
        >
          {photos.map((x) => (
            <option key={x.id} value={x.id}>
              {dayLabel(x.takenAt)}
            </option>
          ))}
        </select>
        {p && <VaultImage id={p.id} alt={`${dayLabel(p.takenAt)} 눈바디`} className="aspect-[3/4] w-full rounded-2xl object-cover" />}
        <p className="tabular text-center text-[13px] text-text-muted">{w ? `그날 체중 ${w.toFixed(1)}kg` : '그날 체중 기록 없음'}</p>
      </div>
    )
  }
  return (
    <>
      <PageHeader title="눈바디 비교" back="/record/eyebody" />
      {state === 'loading' ? (
        <LoadingState />
      ) : state !== 'unlocked' ? (
        <PasswordGate mode={state} onDone={refresh} />
      ) : photos.length < 2 ? (
        <EmptyState title="비교하려면 사진이 2장 이상 필요해요" action={<Button asChild><Link to="/record/eyebody">사진 추가</Link></Button>} />
      ) : (
        <div className="flex gap-3 md:max-w-2xl">
          {side('a')}
          {side('b')}
        </div>
      )}
    </>
  )
}
