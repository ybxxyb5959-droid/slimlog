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
    command: 'npm run build && npx vite preview --port 4173 --strictPort',
    port: 4173,
    reuseExistingServer: true,
    timeout: 120_000,
  },
})
