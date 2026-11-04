import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router'

import { BottomTabBar } from './BottomTabBar'
import { Sidebar } from './Sidebar'

export function AppLayout() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return (
    <div className="min-h-dvh">
      <Sidebar />
      <main className="md:pl-20 lg:pl-60">
        <div className="mx-auto w-full max-w-[1120px] px-5 pt-[calc(1.5rem+var(--sat))] pb-[calc(6rem+var(--sab))] md:px-8 md:pt-[calc(2rem+var(--sat))] md:pb-12">
          <Outlet />
        </div>
      </main>
      <BottomTabBar />
    </div>
  )
}
