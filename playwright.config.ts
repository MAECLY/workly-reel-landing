import { defineConfig } from '@playwright/test';

/**
 * The end-to-end gate.
 *
 * `pnpm test:e2e` existed before this file did and could only fail: without a
 * config Playwright scans the repository root, finds the Vitest suites under
 * `tests/`, and dies parsing them. `testDir` and `testMatch` therefore draw a
 * hard line between the two runners, and the `.e2e.ts` suffix holds it from the
 * other side: the Vitest `include` glob matches `.test.ts` and `.test.tsx`
 * only, so neither runner can pick up the other's files.
 *
 * The server is the production one. Every claim these tests make about
 * headers, the sitemap, and the optimised images is only true of `next start`,
 * so a dev server would pass tests that a deployment would fail.
 */

const PORT = 3210;
const BASE_URL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: /.*\.e2e\.ts$/,
  fullyParallel: true,
  /* A `.only` left in a spec passes locally and silently narrows CI to it. */
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : '50%',
  /* The HTML report is never opened automatically; CI keeps it as an artefact. */
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        browserName: 'chromium',
        viewport: { width: 1280, height: 900 },
        deviceScaleFactor: 1,
      },
    },
    {
      /**
       * A phone-shaped viewport, still on Chromium.
       *
       * Written out rather than spread from `devices['iPhone 15']` because that
       * descriptor also carries `defaultBrowserType: 'webkit'` and a Safari user
       * agent. WebKit is not installed here, and running Chromium while claiming
       * to be Safari would make a failure harder to read, not easier.
       */
      name: 'mobile-chromium',
      use: {
        browserName: 'chromium',
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: {
    command: `pnpm build && pnpm start -p ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
