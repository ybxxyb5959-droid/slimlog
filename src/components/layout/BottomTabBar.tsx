import { NavLink } from 'react-router'

import { MAIN_TABS } from '@/app/navigation'
import { AppIcon } from '@/components/common/AppIcon'
import { cn } from '@/lib/utils'

/** 768px 미만 하단 5탭 */
export function BottomTabBar() {
  return (
    <nav
      aria-label="주 메뉴"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 pb-[var(--sab)] backdrop-blur md:hidden"
    >
      <ul className="mx-auto grid h-16 max-w-lg grid-cols-5">
        {MAIN_TABS.map((tab) => (
          <li key={tab.to}>
            <NavLink
              to={tab.to}
              className={({ isActive }) =>
                cn(
                  'flex h-full flex-col items-center justify-center gap-1 text-[11px] font-medium',
                  isActive ? 'font-semibold text-icon' : 'text-text-subtle',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <AppIcon icon={tab.icon} size="md" tone={isActive ? 'primary' : 'muted'} />
                  {tab.label}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
