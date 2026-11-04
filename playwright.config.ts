import { defineConfig } from '@playwright/test'

const executablePath = process.env.PW_CHROMIUM_PATH // 클라우드 환경: /opt/pw-browsers/chromium

export default defineConfig({
  fullyParallel: true,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4173',
    launchOptions: executablePath ? { executablePath } : {},
  },
  projects: [
    { name: 'unit', testDir: './tests/unit' },
    { name: 'mobile-390', testDir: './tests/e2e', use: { viewport: { width: 390, height: 844 }, hasTouch: true } },
    { name: 'tablet-768', testDir: './tests/e2e', use: { viewport: { width: 768, height: 1024 } } },
    { name: 'desktop-1440', testDir: './tests/e2e', use: { viewport: { width: 1440, height: 900 } } },
  ],
  webServer: {
    // 테스트 빌드는 dist-e2e 에 따로 (배포용 dist 에 테스트 훅이 섞이지 않게)
    command: 'npx tsc -b && npx vite build --outDir dist-e2e && npx vite preview --outDir dist-e2e --port 4173 --strictPort',
    port: 4173,
    reuseExistingServer: true,
    timeout: 120_000,
    // 테스트 빌드에서만 가짜 지문 훅 (src/lib/biometric.ts)
    env: { VITE_E2E_HOOKS: '1' },
  },
})
