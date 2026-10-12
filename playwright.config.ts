import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/web',
  timeout: 45000,
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
    browserName: 'chromium',
    channel:
      process.env.PLAYWRIGHT_CHANNEL === ''
        ? undefined
        : (process.env.PLAYWRIGHT_CHANNEL ?? 'chrome'),
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  reporter: [['list']],
});
