import { Camera, Image as ImageIcon, Images, LockKeyhole, MoreHorizontal, Pencil, RefreshCw, Trash2, ZoomIn } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router'
import { toast } from 'sonner'

import { BottomSheet } from '@/components/common/BottomSheet'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { Notice } from '@/components/common/Notice'
import { PageHeader } from '@/components/common/PageHeader'
import { LoadingState } from '@/components/common/StateViews'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatShortDateWithDay, toDateKey } from '@/lib/date'
import {
  addPhoto,
  ANGLES,
  beginPicker,
  endPicker,
  listPhotos,
  LOCAL_ONLY_NOTICE,
  LOCK_EVENT,
  lock,
  removePhoto,
  setVaultUser,
  updatePhotoMeta,
  vaultState,
  type Angle,
  type PhotoMeta,
} from '@/lib/eyebodyVault'
import { clearCaptureFiles, isNativeApp, setSecureScreen } from '@/lib/native'
import { cn } from '@/lib/utils'
import { useBodyLogs } from '@/services/body'
import { useAuthStore } from '@/stores/authStore'

import { EyebodyCalendar } from './EyebodyCalendar'
import { PasswordGate, SecuritySettings } from './EyebodyLock'
import { PhotoZoom } from './PhotoZoom'
import { VaultImage } from './VaultImage'

const angleLabel = (a: Angle) => ANGLES.find((x) => x.value === a)!.label
const dayLabel = (k: string) => formatShortDateWithDay(new Date(`${k}T12:00:00`))
const longDate = (k: string) => {
  const d = new Date(`${k}T12:00:00`)
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`
}

function useVault() {
  const uid = useAuthStore((s) => s.account?.userId ?? null)
  const [state, setState] = useState<'loading' | 'new' | 'locked' | 'unlocked'>('loading')
  const refresh = useCallback(() => {
    setVaultUser(uid)
    vaultState().then(setState).catch(() => setState('new'))
  }, [uid])
  useEffect(() => refresh(), [refresh])
  // 자동 잠금(백그라운드·5분 무입력·로그아웃)되면 바로 잠금 화면으로
  useEffect(() => {
    window.addEventListener(LOCK_EVENT, refresh)
    return () => window.removeEventListener(LOCK_EVENT, refresh)
  }, [refresh])
  return { state, refresh }
}

/** 날짜 → 각도 → 사진들(최신 먼저). 같은 칸에 여러 장이면(예전 데이터) 첫 장이 대표 */
function groupPhotos(photos: PhotoMeta[]) {
  const map = new Map<string, Map<Angle, PhotoMeta[]>>()
  for (const p of [...photos].sort((a, b) => b.createdAt.localeCompare(a.createdAt))) {
    const day = map.get(p.takenAt) ?? new Map<Angle, PhotoMeta[]>()
    day.set(p.angle, [...(day.get(p.angle) ?? []), p])
    map.set(p.takenAt, day)
  }
  return map
}

/** 세그먼트 탭 (기록 보기 | 변화 비교 · 정면 | 측면 | 후면) */
function Segments<T extends string>({ label, items, value, onChange, dots, size = 'lg' }: { label: string; items: { value: T; label: string }[]; value: T; onChange: (v: T) => void; dots?: Set<T>; size?: 'lg' | 'sm' }) {
  return (
    <div role="tablist" aria-label={label} className={cn('grid gap-1 rounded-full bg-surface-muted p-1', items.length === 2 ? 'grid-cols-2' : 'grid-cols-3')}>
      {items.map((it) => (
        <button
          key={it.value}
          type="button"
          role="tab"
          aria-selected={value === it.value}
          onClick={() => onChange(it.value)}
          className={cn(
            'inline-flex items-center justify-center gap-1.5 rounded-full font-medium transition-colors',
            size === 'lg' ? 'h-11 text-[15px]' : 'h-9 text-[14px]',
            value === it.value ? 'bg-surface font-semibold text-text shadow-[0_1px_2px_rgba(15,23,42,0.08)]' : 'text-text-muted',
          )}
        >
          {it.label}
          {dots && <span aria-hidden className={cn('size-1.5 rounded-full', dots.has(it.value) ? 'bg-primary' : 'bg-transparent')} />}
        </button>
      ))}
    </div>
  )
}

type Tab = 'record' | 'compare'
/** 비교 방식 — 지금은 좌우 비교만. 나중에 'slider'(겹쳐서 밀어 보기)를 여기에 추가 */
type CompareMode = 'side'

/** /record/eyebody — 기록 보기 | 변화 비교 (사진은 이 기기에만) */
export function EyebodyPage() {
  const { state, refresh } = useVault()
  const [params, setParams] = useSearchParams()
  const tab: Tab = params.get('tab') === 'compare' ? 'compare' : 'record'
  const setTab = (t: Tab) => setParams((p) => ({ ...Object.fromEntries(p), tab: t }), { replace: true })
  const [photos, setPhotos] = useState<PhotoMeta[] | null>(null)
  const [date, setDate] = useState(() => toDateKey(new Date()))
  const [angle, setAngle] = useState<Angle>('front')
  const [calOpen, setCalOpen] = useState(true)
  const [settings, setSettings] = useState(false)

  const reload = useCallback(async () => setPhotos(await listPhotos()), [])
  // 갤럭시 앱: 눈바디 화면에 있는 동안만 FLAG_SECURE (최근 앱 미리보기·스크린샷 차단)
  useEffect(() => {
    void setSecureScreen(true)
    return () => void setSecureScreen(false)
  }, [])
  useEffect(() => {
    if (state === 'unlocked') listPhotos().then(setPhotos)
  }, [state])

  return (
    <>
      <PageHeader
        title="눈바디"
        back="/record"
        actions={
          state === 'unlocked' ? (
            <Button variant="ghost" size="icon" aria-label="눈바디 설정" onClick={() => setSettings(true)}>
              <MoreHorizontal size={22} aria-hidden />
            </Button>
          ) : undefined
        }
      />
      {state === 'loading' ? (
        <LoadingState />
      ) : state !== 'unlocked' ? (
        <PasswordGate mode={state} onDone={refresh} />
      ) : photos === null ? (
        <LoadingState />
      ) : (
        <div className="space-y-4 md:max-w-2xl">
          <Segments<Tab>
            label="눈바디 화면"
            items={[
              { value: 'record', label: '기록 보기' },
              { value: 'compare', label: '변화 비교' },
            ]}
            value={tab}
            onChange={setTab}
          />
          {tab === 'record' ? (
            <RecordView photos={photos} reload={reload} date={date} setDate={setDate} angle={angle} setAngle={setAngle} calOpen={calOpen} setCalOpen={setCalOpen} />
          ) : (
            <CompareView
              photos={photos}
              onRegister={(d, a) => {
                setDate(d)
                setAngle(a)
                setTab('record')
              }}
            />
          )}
        </div>
      )}
      <BottomSheet open={settings} onRequestClose={() => setSettings(false)} title="눈바디 설정">
        <div className="space-y-3 pb-2">
          <Notice tone="review" title="사진 보관 안내">
            {LOCAL_ONLY_NOTICE}.
          </Notice>
          <ul className="space-y-1 text-[13px] leading-relaxed text-text-muted">
            <li>· 사진은 암호화해서 이 기기 앱 저장소에만 둬요. 서버나 외부 AI 로 보내지 않아요.</li>
            <li>· 휴대폰 갤러리에 따로 저장하지 않아요.</li>
            <li>· 다른 앱으로 넘어가거나, 5분 동안 손대지 않거나, 로그아웃하면 자동으로 잠겨요.</li>
          </ul>
          <SecuritySettings />
          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              lock()
              setSettings(false)
              refresh()
            }}
          >
            <LockKeyhole size={16} aria-hidden /> 지금 잠그기
          </Button>
          <Button asChild variant="ghost" className="w-full">
            <Link to="/my/eyebody-data">로컬 데이터 관리 (용량 · 전체 삭제)</Link>
          </Button>
        </div>
      </BottomSheet>
    </>
  )
}

function RecordView({
  photos,
  reload,
  date,
  setDate,
  angle,
  setAngle,
  calOpen,
  setCalOpen,
}: {
  photos: PhotoMeta[]
  reload: () => Promise<void>
  date: string
  setDate: (d: string) => void
  angle: Angle
  setAngle: (a: Angle) => void
  calOpen: boolean
  setCalOpen: (o: boolean) => void
}) {
  const groups = useMemo(() => groupPhotos(photos), [photos])
  const marked = useMemo(() => new Set(groups.keys()), [groups])
  const day = groups.get(date)
  const slot = day?.get(angle) ?? []
  const main = slot[0] ?? null
  const extras = slot.slice(1)
  const weights = useBodyLogs()
  const weight = weights.filter((w) => toDateKey(new Date(w.measuredAt)) === date).at(-1)?.weightKg

  const camera = useRef<HTMLInputElement>(null)
  const gallery = useRef<HTMLInputElement>(null)
  const [regOpen, setRegOpen] = useState(false)
  const [regAngle, setRegAngle] = useState<Angle>(angle)
  const [pending, setPending] = useState<{ file: File; angle: Angle; replace: PhotoMeta[] } | null>(null)
  const [busy, setBusy] = useState(false)
  const [zoom, setZoom] = useState<PhotoMeta | null>(null)
  const [edit, setEdit] = useState<PhotoMeta | null>(null)
  const [del, setDel] = useState<PhotoMeta | null>(null)

  const openRegister = (a: Angle) => {
    setRegAngle(a)
    setRegOpen(true)
  }
  const save = async (file: File, a: Angle, replace: PhotoMeta[]) => {
    setBusy(true)
    try {
      await addPhoto(file, date, a, replace.map((p) => p.id))
      await reload()
      setAngle(a)
      toast.success(replace.length ? `${angleLabel(a)} 사진을 바꿨어요` : '눈바디 사진을 저장했어요', { description: '이 기기에만 암호화해서 저장했어요.' })
    } catch (err) {
      toast.error('저장하지 못했어요', { description: (err as Error).message })
    } finally {
      setBusy(false)
    }
  }
  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    endPicker()
    const picked = e.target.files?.[0]
    e.target.value = ''
    if (!picked) return
    // 갤럭시 앱: 촬영 임시 파일(평문 JPG)을 메모리로 옮긴 뒤 바로 지운다. 저장은 암호화된 것만
    const f = isNativeApp() ? new File([await picked.arrayBuffer()], picked.name, { type: picked.type || 'image/jpeg' }) : picked
    void clearCaptureFiles()
    setRegOpen(false)
    const existing = groups.get(date)?.get(regAngle) ?? []
    if (existing.length) setPending({ file: f, angle: regAngle, replace: existing })
    else void save(f, regAngle, [])
  }

  return (
    <>
      <div className="text-center">
        <h2 className="tabular text-[24px] font-bold">{longDate(date)}</h2>
        <p className="mt-0.5 text-[13px] text-text-muted">나의 몸 변화 기록{weight ? ` · 그날 체중 ${weight.toFixed(1)}kg` : ''}</p>
      </div>
      <Segments<Angle> label="사진 각도" size="sm" items={ANGLES} value={angle} onChange={setAngle} dots={new Set(day ? [...day.keys()] : [])} />

      {main ? (
        <Card className="space-y-3 p-3">
          <button type="button" onClick={() => setZoom(main)} aria-label={`${dayLabel(date)} ${angleLabel(angle)} 사진 크게 보기`} className="relative mx-auto block w-full max-w-[360px] overflow-hidden rounded-2xl">
            <VaultImage id={main.id} alt={`${dayLabel(date)} ${angleLabel(angle)} 눈바디`} className="aspect-[3/4] max-h-[min(50dvh,480px)] w-full object-cover" />
            <span aria-hidden className="absolute right-2 bottom-2 inline-flex size-8 items-center justify-center rounded-full bg-black/45 text-white">
              <ZoomIn size={16} />
            </span>
          </button>
          <div className="grid grid-cols-3 gap-2">
            <Button variant="outline" size="sm" disabled={busy} onClick={() => openRegister(angle)}>
              <RefreshCw size={15} aria-hidden /> 다시 찍기
            </Button>
            <Button variant="outline" size="sm" onClick={() => setEdit(main)}>
              <Pencil size={15} aria-hidden /> 수정
            </Button>
            <Button variant="outline" size="sm" className="text-danger hover:bg-danger-soft hover:text-danger" onClick={() => setDel(main)}>
              <Trash2 size={15} aria-hidden /> 삭제
            </Button>
          </div>
          {extras.length > 0 && (
            <div className="rounded-2xl bg-surface-muted p-3">
              <p className="text-[13px] font-semibold">같은 각도 예전 사진 {extras.length}장</p>
              <p className="text-[12px] text-text-muted">각도를 고르기 전에 저장한 사진이에요. 각도를 바꾸거나 지워 주세요.</p>
              <ul className="mt-2 flex gap-2 overflow-x-auto" aria-label="같은 각도 예전 사진">
                {extras.map((p) => (
                  <li key={p.id} className="w-20 shrink-0 space-y-1">
                    <VaultImage id={p.id} thumb alt={`${dayLabel(date)} 예전 사진`} className="aspect-[3/4] w-full rounded-xl object-cover" />
                    <div className="flex justify-between">
                      <button type="button" aria-label="예전 사진 각도 바꾸기" onClick={() => setEdit(p)} className="inline-flex size-8 items-center justify-center rounded-full hover:bg-surface">
                        <Pencil size={14} aria-hidden />
                      </button>
                      <button type="button" aria-label="예전 사진 삭제" onClick={() => setDel(p)} className="inline-flex size-8 items-center justify-center rounded-full hover:bg-surface">
                        <Trash2 size={14} aria-hidden />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      ) : (
        <section aria-label="사진 없음" className="flex flex-col items-center rounded-3xl bg-surface-muted px-6 py-10 text-center">
          <Images size={40} strokeWidth={1.5} aria-hidden className="text-text-subtle" />
          <p className="mt-3 text-[17px] font-bold">등록된 변화가 없어요</p>
          <p className="mt-1 text-[14px] text-text-muted">{day ? `이 날 ${angleLabel(angle)} 사진은 아직 없어요` : '오늘의 모습을 사진으로 남겨보세요'}</p>
          <Button className="mt-5 rounded-full px-6" disabled={busy} onClick={() => openRegister(angle)}>
            <Camera size={18} aria-hidden /> 사진 등록하기
          </Button>
        </section>
      )}

      <EyebodyCalendar value={date} onChange={setDate} marked={marked} open={calOpen} onOpenChange={setCalOpen} />

      {/* 파일 선택 — 카메라는 후면, 앨범은 읽기만 (갤러리에 저장하지 않음) */}
      <input ref={camera} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} aria-label="눈바디 카메라" onChange={onFile} />
      <input ref={gallery} type="file" accept="image/*" className="sr-only" tabIndex={-1} aria-label="눈바디 사진 선택" onChange={onFile} />

      <BottomSheet open={regOpen} onRequestClose={() => setRegOpen(false)} title="사진 등록" description={`${dayLabel(date)} · 이 기기에만 암호화해서 저장돼요`}>
        <div className="space-y-4 pb-2">
          <div>
            <p className="mb-2 text-[14px] font-semibold">어느 각도인가요?</p>
            <Segments<Angle> label="등록할 각도" size="sm" items={ANGLES} value={regAngle} onChange={setRegAngle} dots={new Set(day ? [...day.keys()] : [])} />
            {day?.get(regAngle)?.length ? <p className="mt-1.5 text-[12px] text-text-muted">이미 {angleLabel(regAngle)} 사진이 있어요. 새로 찍으면 바꿀지 물어볼게요.</p> : null}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => (beginPicker(), camera.current?.click())} className="flex h-24 flex-col items-center justify-center gap-2 rounded-2xl border border-border bg-surface text-[15px] font-semibold hover:bg-surface-muted">
              <Camera size={24} strokeWidth={1.75} aria-hidden className="text-icon" /> 카메라
            </button>
            <button type="button" onClick={() => (beginPicker(), gallery.current?.click())} className="flex h-24 flex-col items-center justify-center gap-2 rounded-2xl border border-border bg-surface text-[15px] font-semibold hover:bg-surface-muted">
              <ImageIcon size={24} strokeWidth={1.75} aria-hidden className="text-icon" /> 앨범
            </button>
          </div>
          <p className="text-[12px] text-text-subtle">같은 자세·같은 장소·같은 거리에서 찍으면 비교하기 좋아요. 휴대폰 갤러리에는 저장되지 않아요.</p>
        </div>
      </BottomSheet>

      <ConfirmDialog
        open={!!pending}
        onOpenChange={(o) => !o && setPending(null)}
        title={pending ? `${dayLabel(date)} ${angleLabel(pending.angle)} 사진을 바꿀까요?` : ''}
        description="기존 사진은 지워지고 새 사진으로 바뀌어요. 되돌릴 수 없어요."
        confirmLabel="바꾸기"
        onConfirm={async () => {
          if (!pending) return
          const p = pending
          setPending(null)
          await save(p.file, p.angle, p.replace)
        }}
      />

      <EditSheet
        photo={edit}
        groups={groups}
        onClose={() => setEdit(null)}
        onSaved={async (m) => {
          await reload()
          setDate(m.takenAt)
          setAngle(m.angle)
        }}
      />

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
          await reload()
          setDel(null)
          toast('사진을 삭제했어요')
        }}
      />

      <PhotoZoom photo={zoom} title={zoom ? `${dayLabel(zoom.takenAt)} ${angleLabel(zoom.angle)}` : ''} onClose={() => setZoom(null)} />
    </>
  )
}

/** 사진 수정 — 날짜·각도만 바꾼다 (사진 자체는 그대로). 옮길 칸에 사진이 있으면 바꿀지 확인 */
type EditProps = { groups: Map<string, Map<Angle, PhotoMeta[]>>; onClose: () => void; onSaved: (m: PhotoMeta) => Promise<void> }
function EditSheet({ photo, ...rest }: EditProps & { photo: PhotoMeta | null }) {
  return photo ? <EditSheetBody key={photo.id} photo={photo} {...rest} /> : null
}

function EditSheetBody({ photo, groups, onClose, onSaved }: EditProps & { photo: PhotoMeta }) {
  const [d, setD] = useState(photo.takenAt)
  const [a, setA] = useState<Angle>(photo.angle)
  const [confirm, setConfirm] = useState<PhotoMeta[] | null>(null)
  const others = (groups.get(d)?.get(a) ?? []).filter((x) => x.id !== photo.id)
  const unchanged = d === photo.takenAt && a === photo.angle
  const apply = async (replace: PhotoMeta[]) => {
    try {
      const m = await updatePhotoMeta(photo.id, { takenAt: d, angle: a }, replace.map((x) => x.id))
      toast.success('사진 정보를 바꿨어요')
      onClose()
      await onSaved(m)
    } catch (err) {
      toast.error('바꾸지 못했어요', { description: (err as Error).message })
    }
  }
  return (
    <>
      <BottomSheet open onRequestClose={onClose} title="사진 정보 수정" description="사진은 그대로 두고 날짜·각도만 바꿔요">
        <div className="space-y-4 pb-2">
          <div>
            <Label htmlFor="eyebodyEditDate">찍은 날짜</Label>
            <Input id="eyebodyEditDate" type="date" value={d} max={toDateKey(new Date())} onChange={(e) => e.target.value && setD(e.target.value)} />
          </div>
          <div>
            <p className="mb-2 text-[14px] font-medium">각도</p>
            <Segments<Angle> label="수정할 각도" size="sm" items={ANGLES} value={a} onChange={setA} />
          </div>
          <Button className="w-full" disabled={unchanged || !d} onClick={() => (others.length ? setConfirm(others) : void apply([]))}>
            저장
          </Button>
        </div>
      </BottomSheet>
      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`${dayLabel(d)} ${angleLabel(a)} 사진을 바꿀까요?`}
        description="그 날짜·각도에 이미 사진이 있어요. 기존 사진은 지워지고 이 사진으로 바뀌어요."
        confirmLabel="바꾸기"
        onConfirm={async () => {
          const r = confirm ?? []
          setConfirm(null)
          await apply(r)
        }}
      />
    </>
  )
}

function CompareView({ photos, onRegister }: { photos: PhotoMeta[]; onRegister: (date: string, angle: Angle) => void }) {
  const mode: CompareMode = 'side'
  const groups = useMemo(() => groupPhotos(photos), [photos])
  const dates = useMemo(() => [...groups.keys()].sort(), [groups])
  const [params, setParams] = useSearchParams()
  const weights = useBodyLogs()
  const [zoom, setZoom] = useState<PhotoMeta | null>(null)
  const angle = (ANGLES.some((x) => x.value === params.get('angle')) ? params.get('angle') : 'front') as Angle
  const pickDate = (k: 'a' | 'b') => {
    const v = params.get(k)
    if (v && dates.includes(v)) return v
    return k === 'a' ? dates[0] : dates.at(-1)
  }
  const set = (patch: Record<string, string>) => setParams((p) => ({ ...Object.fromEntries(p), ...patch }), { replace: true })

  if (dates.length < 2) {
    return (
      <section aria-label="비교할 사진 부족" className="flex flex-col items-center rounded-3xl bg-surface-muted px-6 py-10 text-center">
        <Images size={40} strokeWidth={1.5} aria-hidden className="text-text-subtle" />
        <p className="mt-3 text-[17px] font-bold">비교할 사진이 부족해요</p>
        <p className="mt-1 text-[14px] text-text-muted">서로 다른 두 날짜의 사진이 있어야 비교할 수 있어요. 지금 {dates.length}일 등록돼 있어요.</p>
        <Button className="mt-5 rounded-full px-6" onClick={() => onRegister(toDateKey(new Date()), angle)}>
          <Camera size={18} aria-hidden /> 사진 등록하기
        </Button>
      </section>
    )
  }

  const a = pickDate('a')!
  const b = pickDate('b')!
  const wOn = (k: string) => weights.filter((w) => toDateKey(new Date(w.measuredAt)) === k).at(-1)?.weightKg
  const wa = wOn(a)
  const wb = wOn(b)
  const side = (k: 'a' | 'b', d: string) => {
    const p = groups.get(d)?.get(angle)?.[0]
    const label = k === 'a' ? '이전' : '최근'
    return (
      <div className="min-w-0 flex-1 space-y-2">
        {p ? (
          <button type="button" onClick={() => setZoom(p)} aria-label={`${label} ${dayLabel(d)} ${angleLabel(angle)} 사진 크게 보기`} className="relative block w-full overflow-hidden rounded-2xl">
            <VaultImage id={p.id} alt={`${label} ${dayLabel(d)} ${angleLabel(angle)} 눈바디`} className="aspect-[3/4] w-full object-cover" />
            <span aria-hidden className="absolute right-1.5 bottom-1.5 inline-flex size-7 items-center justify-center rounded-full bg-black/45 text-white">
              <ZoomIn size={14} />
            </span>
          </button>
        ) : (
          <div className="flex aspect-[3/4] w-full flex-col items-center justify-center gap-2 rounded-2xl bg-surface-muted px-2 text-center">
            <ImageIcon size={28} strokeWidth={1.5} aria-hidden className="text-text-subtle" />
            <p className="text-[12px] text-text-muted">이 날 {angleLabel(angle)} 사진이 없어요</p>
            <Button size="sm" variant="outline" onClick={() => onRegister(d, angle)}>
              등록하기
            </Button>
          </div>
        )}
        <select
          aria-label={`${label} 날짜`}
          value={d}
          onChange={(e) => set({ [k]: e.target.value })}
          className="h-11 w-full rounded-full border border-border bg-surface px-4 text-[14px] font-medium text-text"
        >
          {dates.map((x) => (
            <option key={x} value={x}>
              {dayLabel(x)}
            </option>
          ))}
        </select>
        <p className="tabular text-center text-[12px] text-text-muted">{wOn(d) ? `그날 체중 ${wOn(d)!.toFixed(1)}kg` : '그날 체중 기록 없음'}</p>
      </div>
    )
  }

  return (
    <div className="space-y-4" data-compare-mode={mode}>
      <div className="text-center">
        <h2 className="text-[22px] font-bold">나의 변화 비교</h2>
        <p className="mt-0.5 text-[13px] text-text-muted">두 날짜를 선택해 변화를 확인해요</p>
      </div>
      <Segments<Angle> label="비교 각도" size="sm" items={ANGLES} value={angle} onChange={(v) => set({ angle: v })} />
      <div className="flex gap-3">
        {side('a', a)}
        {side('b', b)}
      </div>
      {wa && wb ? (
        <p className="tabular text-center text-[14px]">
          체중 변화 <b>{wb - wa > 0 ? '+' : wb - wa < 0 ? '−' : ''}{Math.abs(wb - wa).toFixed(1)}kg</b>
        </p>
      ) : null}
      <p className="text-center text-[12px] text-text-subtle">사진이 있는 날짜만 고를 수 있어요 · 사진을 누르면 크게 볼 수 있어요</p>
      <PhotoZoom photo={zoom} title={zoom ? `${dayLabel(zoom.takenAt)} ${angleLabel(zoom.angle)}` : ''} onClose={() => setZoom(null)} />
    </div>
  )
}

/** 예전 주소 /record/eyebody/compare → 변화 비교 탭 */
export function EyebodyComparePage() {
  return <Navigate to="/record/eyebody?tab=compare" replace />
}
