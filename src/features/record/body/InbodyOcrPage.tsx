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
async function readText(file: File): Promise<{ text: string; confidence: number }> {
  const { createWorker } = await import('tesseract.js')
  const worker = await createWorker(['kor', 'eng'])
  try {
    const { data } = await worker.recognize(file)
    return { text: data.text, confidence: (data.confidence ?? 0) / 100 }
  } finally {
    await worker.terminate()
  }
}

const toDraft = (p: ParsedInbody): BodyDraft => ({
  ...emptyBodyDraft(),
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
        return void toast('결과지 저장은 서버 연결 후 열려요', { description: '같은 값을 체중 기록에서 직접 입력할 수 있어요.' })
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
      <PageHeader title="인바디 결과지 등록" description="사진 속 숫자를 읽어 채워 드려요. 꼭 확인해 주세요." back="/analysis?tab=inbody" actions={isLive ? undefined : <MockBadge />} />
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
            <p className="text-[12px] leading-relaxed text-text-subtle">결과지 사진은 이 기기 안에서만 읽고 어디에도 올리지 않아요. 지금은 결과지 1종 기준으로 맞춰져 있어 다른 양식은 잘 못 읽을 수 있어요.</p>
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
            {parsed.manualRecommended ? (
              <Notice tone="review" title="자동으로 읽은 값이 불확실해요">
                값을 하나씩 결과지와 비교해 고쳐 주세요. 비워 둔 칸은 저장되지 않아요.
              </Notice>
            ) : (
              <p className="text-[13px] text-text-muted">읽은 값을 결과지와 비교해 확인해 주세요.</p>
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
