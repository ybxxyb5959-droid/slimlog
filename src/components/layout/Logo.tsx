import { Link } from 'react-router'

export function Logo({ compactBelowLg = false }: { compactBelowLg?: boolean }) {
  return (
    <Link to="/home" className="inline-flex items-center gap-2" aria-label="슬림로그 홈">
      <span className="inline-flex size-8 items-center justify-center rounded-[10px] bg-primary">
        <svg viewBox="0 0 32 32" className="size-6" aria-hidden>
          <path d="M7 11c4 0 5 10 9 10s4.5-5 9-5" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
        </svg>
      </span>
      <span className={compactBelowLg ? 'hidden text-[18px] font-bold tracking-tight text-text lg:inline' : 'text-[18px] font-bold tracking-tight text-text'}>
        슬림로그 <span className="text-[13px] font-medium text-text-subtle">SlimLog</span>
      </span>
    </Link>
  )
}
