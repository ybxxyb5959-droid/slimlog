import { RouterProvider } from 'react-router'

import { Toaster } from '@/components/ui/sonner'
import { startAuth } from '@/stores/authStore'

import { router } from './router'

startAuth()

export function App() {
  return (
    <>
      <RouterProvider router={router} />
      <Toaster />
    </>
  )
}
