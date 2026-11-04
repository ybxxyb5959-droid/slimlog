import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { App } from './app/App'
import { initNativeApp } from './lib/nativeApp'
import { initTheme } from './lib/theme'
import './styles/globals.css'

initTheme()
void initNativeApp()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
