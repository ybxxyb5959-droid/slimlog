import { NavLink, useLocation } from 'react-router'

import { ANALYSIS_MENUS, MAIN_TABS, RECORD_MENUS } from '@/app/navigation'
import { AppIcon } from '@/components/common/AppIcon'
import { cn } from '@/lib/utils'

import { Logo } from './Logo'

/** 768px 이상 좌측 사이드바 */
export function Sidebar() {
  const { pathname } = useLocation()
  const sub = pathname.startsWith('/record') ? RECORD_MENUS : pathname.startsWith('/analysis') ? ANALYSIS_MENUS : null

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-20 flex-col border-r border-border bg-surface md:flex lg:w-60">
      <div className="flex justify-center pt-6 pb-5 lg:justify-start lg:px-5">
        <Logo compactBelowLg />
      </div>
      <nav aria-label="주 메뉴" className="flex-1 overflow-y-auto px-2 lg:px-3">
        <ul className="space-y-1">
          {MAIN_TABS.map((tab) => (
            <li key={tab.to}>
              <NavLink
                to={tab.to}
                className={({ isActive }) =>
                  cn(
                    'flex h-14 flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] font-medium transition-colors lg:h-11 lg:flex-row lg:justify-start lg:gap-3 lg:px-3 lg:text-[15px]',
                    isActive ? 'bg-icon-soft font-semibold text-icon' : 'text-text-muted hover:bg-surface-muted hover:text-text',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <AppIcon icon={tab.icon} size="sm" tone={isActive ? 'primary' : 'muted'} />
                    {tab.label}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>

        {sub && (
          <div className="mt-6 hidden border-t border-border pt-5 lg:block">
            <p className="px-3 pb-2 text-[12px] font-semibold text-text-subtle">
              {pathname.startsWith('/record') ? '기록 메뉴' : '분석 메뉴'}
            </p>
            <ul className="space-y-0.5">
              {sub.map((m) => (
                <li key={m.to}>
                  <NavLink
                    to={m.to}
                    className={({ isActive }) =>
                      cn(
                        'flex h-10 items-center gap-2.5 rounded-lg px-3 text-[14px] transition-colors',
                        isActive ? 'font-semibold text-text' : 'text-text-muted hover:bg-surface-muted hover:text-text',
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <AppIcon icon={m.icon} size="sm" tone={isActive ? 'primary' : 'muted'} className="size-[18px]" />
                        <span className="truncate">{m.label}</span>
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        )}
      </nav>
      <p className="m-3 hidden rounded-xl bg-surface-muted px-3 py-2.5 text-[12px] leading-relaxed text-text-muted lg:block">
        UI 목업 단계 · 예시 데이터만 표시되며 실제로 저장되지 않아요.
      </p>
    </aside>
  )
}
