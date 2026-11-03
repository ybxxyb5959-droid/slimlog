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
        <div className="mx-auto w-full max-w-[1120px] px-5 pt-6 pb-[calc(6rem+env(safe-area-inset-bottom))] md:px-8 md:pt-8 md:pb-12">
          <Outlet />
        </div>
      </main>
      <BottomTabBar />
    </div>
  )
}
