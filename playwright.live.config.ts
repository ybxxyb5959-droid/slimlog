import { execSync } from 'node:child_process'

import { defineConfig } from '@playwright/test'

/**
 * 실서비스(live) 모드 E2E — 로컬 Supabase(공식 CLI)에 실제로 붙어서 검증한다.
 * 사전: npx supabase start
 * 실행: PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npx playwright test -c playwright.live.config.ts
 */
const executablePath = process.env.PW_CHROMIUM_PATH

function localSupabase() {
  if (process.env.LIVE_SUPABASE_URL && process.env.LIVE_SUPABASE_ANON_KEY)
    return { url: process.env.LIVE_SUPABASE_URL, anon: process.env.LIVE_SUPABASE_ANON_KEY, service: process.env.LIVE_SUPABASE_SERVICE_KEY ?? '' }
  const out = execSync('npx -y supabase status -o env', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
  const get = (k: string) => out.match(new RegExp(`^${k}="?([^"\\n]+)"?`, 'm'))?.[1] ?? ''
  return { url: get('API_URL'), anon: get('ANON_KEY'), service: get('SERVICE_ROLE_KEY') }
}
const sb = localSupabase()
process.env.LIVE_SUPABASE_URL = sb.url
process.env.LIVE_SUPABASE_ANON_KEY = sb.anon
process.env.LIVE_SUPABASE_SERVICE_KEY = sb.service

export default defineConfig({
  testDir: './tests/live',
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  timeout: 60_000,
  use: {
    baseURL: 'http://localhost:5174',
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    launchOptions: executablePath ? { executablePath } : {},
  },
  webServer: {
    command: 'npx vite --port 5174 --strictPort',
    port: 5174,
    reuseExistingServer: false,
    timeout: 120_000,
    env: { VITE_SUPABASE_URL: sb.url, VITE_SUPABASE_ANON_KEY: sb.anon, VITE_DEV_LOGIN: '1' },
  },
})
