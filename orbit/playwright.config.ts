import { defineConfig, devices } from "@playwright/test";

/**
 * E2E_FULL=1 runs the full flow against a real Supabase-compatible stack
 * (see scripts/local-stack.sh and .env.e2e). Without it only public pages
 * and the unconfigured behaviour are exercised.
 */
const full = process.env.E2E_FULL === "1";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : undefined,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  grepInvert: full ? /@unconfigured/ : /@full/,
  webServer: {
    command: "npm run build && npm run start",
    url: "http://localhost:3000",
    timeout: 240_000,
    reuseExistingServer: true,
  },
});
