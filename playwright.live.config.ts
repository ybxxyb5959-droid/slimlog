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
    return { url: process.env.LIVE_SUPABASE_URL, anon: process.env.LIVE_SUPABASE_ANON_KEY, service: process.env.LIVE_SUPABASE_SERVICE_KEY ?? '', jwt: process.env.LIVE_SUPABASE_JWT_SECRET ?? '' }
  const out = execSync('npx -y supabase status -o env', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
  const get = (k: string) => out.match(new RegExp(`^${k}="?([^"\\n]+)"?`, 'm'))?.[1] ?? ''
  return { url: get('API_URL'), anon: get('ANON_KEY'), service: get('SERVICE_ROLE_KEY'), jwt: get('JWT_SECRET') }
}
const sb = localSupabase()
process.env.LIVE_SUPABASE_URL = sb.url
process.env.LIVE_SUPABASE_ANON_KEY = sb.anon
process.env.LIVE_SUPABASE_SERVICE_KEY = sb.service
process.env.LIVE_SUPABASE_JWT_SECRET = sb.jwt

export default defineConfig({
  testDir: './tests/live',
  globalTeardown: './tests/live/teardown.ts',
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  timeout: 90_000,
  // 클라우드(실서비스 DB)는 로컬보다 응답이 느려 화면 확인 대기를 넉넉히
  expect: { timeout: 15_000 },
  use: {
    baseURL: 'http://localhost:5174',
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    launchOptions: executablePath ? { executablePath } : {},
  },
  webServer: [
    {
      command: 'npx vite --port 5174 --strictPort',
      port: 5174,
      reuseExistingServer: false,
      timeout: 120_000,
      env: { VITE_SUPABASE_URL: sb.url, VITE_SUPABASE_ANON_KEY: sb.anon, VITE_DEV_LOGIN: '1', VITE_API_URL: 'http://localhost:8001' },
    },
    {
      // SlimLog API (FastAPI) — 모델 파일 없음 → 목업 인식 모드
      command: 'server/.venv/bin/uvicorn app.main:app --app-dir server --port 8001',
      url: 'http://localhost:8001/health',
      reuseExistingServer: false,
      timeout: 90_000,
  // 클라우드(실서비스 DB)는 로컬보다 응답이 느려 화면 확인 대기를 넉넉히
  expect: { timeout: 15_000 },
      env: { SUPABASE_URL: sb.url, SUPABASE_SERVICE_ROLE_KEY: sb.service, SUPABASE_JWT_SECRET: sb.jwt, ALLOWED_ORIGINS: 'http://localhost:5174', FOOD_MODEL_PATH: 'server/models/__none__.onnx' },
    },
  ],
})
