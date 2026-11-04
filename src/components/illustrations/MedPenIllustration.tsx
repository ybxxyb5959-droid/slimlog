import type { MedicationId } from '@/types/domain'
import { cn } from '@/lib/utils'

/**
 * 약 고르기용 주사 펜 그림 — 세 약을 모양·색으로 구분한다.
 * 실제 제품 사진·로고·디자인을 베끼지 않은 범용 그림 (상표는 화면에서 가림)
 *  - 터제파타이드: 끝에 용량 다이얼이 달린 펜 (보라)
 *  - 세마글루타이드: 가늘고 긴 펜 + 용량 창 (분홍)
 *  - 에페글레나타이드: 짧고 굵은 자동 주사기 (청록)
 */
// eslint-disable-next-line react-refresh/only-export-components
export const MED_COLOR: Record<MedicationId, string> = {
  mounjaro: '#6d4fd8',
  wegovy: '#e0458f',
  efpe: '#1f9e93',
}

export function MedPenIllustration({ med, selected, className }: { med: MedicationId; selected?: boolean; className?: string }) {
  const c = MED_COLOR[med]
  return (
    <svg viewBox="0 0 120 100" className={cn('overflow-visible', className)} aria-hidden>
      <g transform="rotate(-38 60 52)" strokeLinejoin="round" strokeWidth={1.5} className="stroke-text-subtle">
        {med === 'mounjaro' && (
          <>
            {/* 바늘 쪽 캡(원뿔) */}
            <path d="M8 44 L24 40 L24 64 L8 60 Z" className="fill-text-muted" />
            <rect x="24" y="38" width="62" height="28" rx="6" className="fill-surface" />
            <rect x="34" y="38" width="22" height="28" style={{ fill: c, stroke: 'none' }} />
            <text x="45" y="55" textAnchor="middle" fontSize="7" fontWeight="700" fill="#fff" stroke="none">0mg</text>
            <rect x="62" y="44" width="16" height="16" rx="3" className="fill-surface-muted" />
            {/* 용량 다이얼 */}
            <rect x="86" y="41" width="14" height="22" rx="4" style={{ fill: c, stroke: 'none' }} />
            <path d="M90 43v18M94 43v18" stroke="#fff" strokeOpacity={0.6} />
          </>
        )}
        {med === 'wegovy' && (
          <>
            <path d="M4 52h10" className="stroke-text-muted" strokeWidth={2} />
            <rect x="14" y="44" width="14" height="16" rx="4" className="fill-surface-muted" />
            <rect x="28" y="40" width="74" height="24" rx="6" className="fill-surface" />
            <rect x="40" y="40" width="18" height="24" style={{ fill: c, stroke: 'none' }} />
            {/* 용량 창 */}
            <rect x="66" y="45" width="24" height="14" rx="3" className="fill-surface-muted" />
            <text x="78" y="55" textAnchor="middle" fontSize="7" fontWeight="600" className="fill-text-muted" stroke="none">0 mg</text>
            <rect x="102" y="44" width="10" height="16" rx="3" className="fill-surface-muted" />
          </>
        )}
        {med === 'efpe' && (
          <>
            {/* 짧고 굵은 자동 주사기: 캡 + 몸통 + 확인 창 + 버튼 */}
            <rect x="14" y="34" width="24" height="36" rx="10" style={{ fill: c, stroke: 'none' }} />
            <rect x="36" y="32" width="56" height="40" rx="12" className="fill-surface" />
            <rect x="48" y="44" width="22" height="16" rx="4" className="fill-surface-muted" />
            <circle cx="59" cy="52" r="3.5" style={{ fill: c, stroke: 'none' }} />
            <rect x="92" y="42" width="10" height="20" rx="4" style={{ fill: c, stroke: 'none' }} />
          </>
        )}
      </g>
      {selected && (
        <g>
          <circle cx="94" cy="72" r="13" fill="#fff" />
          <circle cx="94" cy="72" r="10.5" style={{ fill: c }} />
          <path d="M89 72l3.5 3.5L99 69" stroke="#fff" strokeWidth={2.4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      )}
    </svg>
  )
}
