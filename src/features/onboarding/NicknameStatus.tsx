import { CircleAlert, CircleCheck, LoaderCircle, ShieldCheck, WifiOff } from 'lucide-react'

import { AppIcon } from '@/components/common/AppIcon'
import { cn } from '@/lib/utils'

export type NicknameState =
  | { kind: 'idle' }
  | { kind: 'typing' }
  | { kind: 'checking' }
  | { kind: 'available' }
  | { kind: 'duplicate' }
  | { kind: 'invalid'; message: string }
  | { kind: 'error' }
  | { kind: 'taken-on-save' }

/** 닉네임 상태 한 줄 — 입력 중 / 확인 중 / 사용 가능 / 중복 / 형식 오류 / 네트워크 오류 */
export function NicknameStatus({ state }: { state: NicknameState }) {
  const map = {
    idle: { icon: ShieldCheck, tone: 'muted', text: '닉네임 중복은 서버에서 확인해요.', cls: 'text-text-muted' },
    typing: { icon: ShieldCheck, tone: 'muted', text: '입력을 마치면 사용 가능 여부를 확인해요.', cls: 'text-text-muted' },
    checking: { icon: LoaderCircle, tone: 'muted', text: '사용할 수 있는지 확인하고 있어요…', cls: 'text-text-muted' },
    available: { icon: CircleCheck, tone: 'success', text: '사용할 수 있는 닉네임이에요.', cls: 'text-primary' },
    duplicate: { icon: CircleAlert, tone: 'danger', text: '이미 사용 중인 닉네임이에요. 다른 닉네임을 골라 주세요.', cls: 'text-danger' },
    invalid: { icon: CircleAlert, tone: 'danger', text: '', cls: 'text-danger' },
    error: { icon: WifiOff, tone: 'review', text: '확인하지 못했어요. 연결 상태를 확인하고 다시 시도해 주세요.', cls: 'text-review' },
    'taken-on-save': { icon: CircleAlert, tone: 'danger', text: '방금 다른 분이 먼저 사용했어요. 아래 추천 중에서 고르거나 새로 입력해 주세요.', cls: 'text-danger' },
  } as const
  const s = map[state.kind]
  return (
    <p role="status" aria-live="polite" className={cn('flex items-start gap-2 text-[13px] leading-relaxed', s.cls)}>
      <AppIcon icon={s.icon} size="sm" tone={s.tone} className={cn('mt-px size-[18px]', state.kind === 'checking' && 'animate-spin')} />
      {state.kind === 'invalid' ? state.message : s.text}
    </p>
  )
}
