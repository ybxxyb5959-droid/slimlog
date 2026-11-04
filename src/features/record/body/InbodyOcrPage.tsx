import { Camera, Image as ImageIcon, ScanText } from 'lucide-react'
import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { MockBadge } from '@/components/common/MockBadge'
import { Notice } from '@/components/common/Notice'
import { PageHeader } from '@/components/common/PageHeader'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ApiError, api, apiReady } from '@/lib/api'
import { toDateTimeLocalValue } from '@/lib/date'
import { parseInbody, type ParsedInbody } from '@/lib/inbodyParser'
import { dbErrorMessage, isLive } from '@/lib/supabase'
import { addBody, type BodyInput } from '@/services/body'
import { fetchBodyLogs } from '@/services/live/records'
import { useRecordsStore } from '@/stores/recordsStore'

import { BodyForm } from './BodyForm'
import { emptyBodyDraft, type BodyDraft } from './bodyDraft'

/**
 * 브라우저 안에서 글자 인식 (Tesseract.js) — 결과지 사진은 서버로 보내지 않는다.
 * 언어 데이터(kor+eng)만 처음 한 번 내려받는다. 사용자가 확인·수정한 숫자만 저장.
 */
/**
 * 글자 인식 전 다듬기 (기기 안에서만): 작은 사진은 키우고(종이 결과지는 글자가 작아서 키워야 읽힘),
 * 흑백 + 대비를 올린다. 실패하면 원본 그대로.
 */
async function prepare(file: File): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file)
    const k = Math.min(3, Math.max(1, 2400 / bmp.width))
    const c = document.createElement('canvas')
    c.width = Math.round(bmp.width * k)
    c.height = Math.round(bmp.height * k)
    const g = c.getContext('2d')!
    g.imageSmoothingQuality = 'high'
    g.drawImage(bmp, 0, 0, c.width, c.height)
    bmp.close()
    const d = g.getImageData(0, 0, c.width, c.height)
    const a = d.data
    for (let i = 0; i < a.length; i += 4) {
      const y = Math.max(0, Math.min(255, (0.299 * a[i] + 0.587 * a[i + 1] + 0.114 * a[i + 2] - 128) * 1.6 + 140))
      a[i] = a[i + 1] = a[i + 2] = y
    }
    g.putImageData(d, 0, 0)
    return await new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('blob'))), 'image/png'))
  } catch {
    return file
  }
}

async function readText(file: File): Promise<{ text: string; confidence: number }> {
  const { createWorker } = await import('tesseract.js')
  const worker = await createWorker(['kor', 'eng'])
  try {
    const { data } = await worker.recognize(await prepare(file))
    return { text: data.text, confidence: (data.confidence ?? 0) / 100 }
  } finally {
    await worker.terminate()
  }
}

const toDraft = (p: ParsedInbody): BodyDraft => ({
  ...emptyBodyDraft(),
  // 화면에 측정 시각이 있으면(인바디 앱 '24.09.03 09:56') 그 시각으로, 없으면 지금
  ...(p.measuredAt ? { measuredAt: toDateTimeLocalValue(p.measuredAt) } : {}),
  weightKg: p.values.weightKg?.toString() ?? '',
  skeletalMuscleKg: p.values.skeletalMuscleKg?.toString() ?? '',
  bodyFatKg: p.values.bodyFatKg?.toString() ?? '',
  bodyFatPct: p.values.bodyFatPct?.toString() ?? '',
})

/** /record/inbody — 결과지 사진 → 글자 인식 → 확인·수정 → 저장 */
export function InbodyOcrPage() {
  const navigate = useNavigate()
  const camera = useRef<HTMLInputElement>(null)
  const gallery = useRef<HTMLInputElement>(null)
  const [stage, setStage] = useState<'pick' | 'reading' | 'confirm' | 'failed'>('pick')
  const [parsed, setParsed] = useState<ParsedInbody | null>(null)
  const [confidence, setConfidence] = useState<number | null>(null)
  const [draft, setDraft] = useState<BodyDraft>(emptyBodyDraft)
  const [dup, setDup] = useState<BodyInput | null>(null)

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    setStage('reading')
    try {
      const { text, confidence: c } = await readText(f)
      const p = parseInbody(text)
      setParsed(p)
      setConfidence(c)
      setDraft(toDraft(p))
      setStage('confirm')
    } catch {
      setStage('failed')
    }
  }

  const save = async (input: BodyInput, force = false) => {
    try {
      if (apiReady) {
        // 서버가 같은 규칙으로 다시 검사하고, 출처(BODY_LOG_SOURCES)와 함께 저장
        await api('/body-logs/ocr', {
          json: { measured_at: input.measuredAt, weight_kg: input.weightKg, skeletal_muscle_kg: input.skeletalMuscleKg ?? null, body_fat_kg: input.bodyFatKg ?? null, body_fat_pct: input.bodyFatPct ?? null, ocr_confidence: confidence, force },
        })
        useRecordsStore.setState({ bodyLogs: await fetchBodyLogs() })
      } else if (isLive) {
        return void toast('지금은 결과지를 저장할 수 없어요', { description: '같은 값을 체중 기록에서 직접 입력할 수 있어요.' })
      } else await addBody(input)
      toast.success('인바디 결과를 저장했어요', { description: isLive ? undefined : '목업 · 화면에만 저장돼요.' })
      navigate('/analysis?tab=inbody')
    } catch (e) {
      if (e instanceof ApiError && e.code === 'DUPLICATE_SUSPECTED') return setDup(input)
      toast.error('저장하지 못했어요', { description: (e as Error).message || dbErrorMessage(e) })
    }
  }

  return (
    <>
      <PageHeader title="인바디 결과지 등록" description="결과지 사진이나 인바디 앱 화면 캡처의 숫자를 읽어 채워 드려요." back="/analysis?tab=inbody" actions={isLive ? undefined : <MockBadge />} />
      <div className="space-y-4 md:max-w-lg">
        <input ref={camera} type="file" accept="image/*" capture="environment" className="sr-only" aria-label="결과지 촬영" onChange={onFile} />
        <input ref={gallery} type="file" accept="image/*" className="sr-only" aria-label="결과지 사진 선택" onChange={onFile} />
        {stage === 'pick' && (
          <Card className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="lg" onClick={() => camera.current?.click()}>
                <Camera size={18} strokeWidth={1.75} aria-hidden /> 촬영
              </Button>
              <Button variant="outline" size="lg" onClick={() => gallery.current?.click()}>
                <ImageIcon size={18} strokeWidth={1.75} aria-hidden /> 앨범에서
              </Button>
            </div>
            <p className="text-[12px] leading-relaxed text-text-subtle">사진은 이 기기 안에서만 읽고 어디에도 올리지 않아요. 인바디 앱 '인바디검사 요약' 화면 캡처를 가장 잘 읽어요. 다른 양식은 값을 꼭 확인해 주세요.</p>
          </Card>
        )}
        {stage === 'reading' && (
          <Card className="flex items-center gap-3" role="status">
            <ScanText size={22} strokeWidth={1.75} className="animate-pulse text-icon" aria-hidden />
            <p className="text-[15px]">결과지 글자를 읽는 중… (처음에는 언어 데이터를 내려받아 조금 걸려요)</p>
          </Card>
        )}
        {stage === 'failed' && (
          <Notice tone="review" title="글자를 읽지 못했어요">
            사진이 흐리거나 언어 데이터를 받지 못했을 수 있어요. <Link to="/record/body/new" className="font-semibold underline">직접 입력하기</Link>
          </Notice>
        )}
        {stage === 'confirm' && parsed && (
          <>
            <p className="text-[13px] font-medium text-text-muted" aria-label="읽은 화면 종류">
              {parsed.kind === 'app' ? '인바디 앱 화면으로 읽었어요' : parsed.kind === 'paper' ? '종이 결과지로 읽었어요' : '어떤 화면인지 몰라서 숫자만 찾아봤어요'}
            </p>
            {parsed.kind === 'paper' && parsed.manualRecommended && (
              <Notice tone="review" title="종이 결과지를 잘 읽지 못했어요">
                결과지가 사진에 꽉 차게, 밝은 곳에서 정면으로 다시 찍으면 더 잘 읽어요. 인바디 앱에 같은 기록이 있다면 앱 화면 캡처가 가장 정확해요.
              </Notice>
            )}
            {parsed.manualRecommended ? (
              <Notice tone="review" title="자동으로 읽은 값이 불확실해요">
                값을 하나씩 결과지와 비교해 고쳐 주세요. 비워 둔 칸은 저장되지 않아요.
              </Notice>
            ) : (
              <p className="text-[13px] text-text-muted">읽은 값을 결과지와 비교해 확인해 주세요. 화면에 없는 항목(예: 체지방량)은 빈칸으로 두면 저장되지 않아요.</p>
            )}
            {parsed.problems.length > 0 && (
              <ul className="space-y-1 text-[13px] text-review" aria-label="확인 필요 항목">
                {parsed.problems.map((p, i) => (
                  <li key={i}>· {p.message}</li>
                ))}
              </ul>
            )}
            <Card>
              <BodyForm draft={draft} onChange={setDraft} submitLabel="확인하고 저장" onSubmit={(input) => save(input)} />
            </Card>
            <Button variant="ghost" className="w-full" onClick={() => setStage('pick')}>
              다른 사진으로 다시
            </Button>
          </>
        )}
      </div>
      <ConfirmDialog
        open={!!dup}
        onOpenChange={(o) => !o && setDup(null)}
        title="비슷한 기록이 이미 있어요"
        description="10분 안에 거의 같은 체중이 기록되어 있어요. 그래도 저장할까요?"
        confirmLabel="그래도 저장"
        onConfirm={() => {
          const v = dup
          setDup(null)
          if (v) void save(v, true)
        }}
      />
    </>
  )
}
