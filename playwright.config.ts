import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://127.0.0.1:3100",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    ...devices["Desktop Chrome"],
  },
  webServer: {
    command: "npx next start -p 3100",
    url: "http://127.0.0.1:3100",
    // Never reuse an unrelated dev server: its environment would not carry the
    // pinned evaluation date, so the journeys would silently depend on today.
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      CONSENT_GATE_ALLOW_TEST_CLOCK: "1",
      CONSENT_GATE_EVALUATION_DATE: "2026-10-19",
    },
  },
});
