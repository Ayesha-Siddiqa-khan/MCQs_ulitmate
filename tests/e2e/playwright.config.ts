import { defineConfig } from "@playwright/test";

const frontendUrl = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const backendUrl = process.env.E2E_API_BASE_URL ?? "http://localhost:8000";
const skipWebServer = process.env.E2E_SKIP_WEBSERVER === "1";

export default defineConfig({
  testDir: ".",
  testMatch: ["*.spec.ts"],
  timeout: 60_000,
  expect: {
    timeout: 10_000
  },
  use: {
    baseURL: frontendUrl,
    trace: "on-first-retry"
  },
  webServer: skipWebServer
    ? undefined
    : [
        {
          command: "uv run uvicorn app.main:app --port 8000",
          cwd: "../../backend",
          url: `${backendUrl}/healthz`,
          reuseExistingServer: true,
          timeout: 120_000
        },
        {
          command: "npm run dev",
          cwd: "../../frontend",
          url: frontendUrl,
          reuseExistingServer: true,
          timeout: 120_000
        }
      ]
});
