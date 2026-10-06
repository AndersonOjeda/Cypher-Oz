import { defineConfig } from "@playwright/test";
import path from "node:path";

const backend = path.resolve(__dirname, "../backend");
const python =
  process.platform === "win32"
    ? '".venv\\Scripts\\python.exe"'
    : ".venv/bin/python";
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 45000,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://localhost:3001",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: [
    {
      command: `${python} scripts/e2e_server.py`,
      cwd: backend,
      url: "http://127.0.0.1:8001/health/",
      reuseExistingServer: false,
      timeout: 90000,
    },
    {
      command: "npm run dev -- --port 3001",
      env: { DJANGO_URL: "http://127.0.0.1:8001", TTI_E2E: "1" },
      url: "http://localhost:3001",
      reuseExistingServer: false,
      timeout: 90000,
    },
  ],
  projects: [
    {
      name: "mobile",
      use: { browserName: "chromium", viewport: { width: 390, height: 844 } },
    },
    {
      name: "tablet",
      use: { browserName: "chromium", viewport: { width: 768, height: 1024 } },
    },
    {
      name: "desktop",
      use: { browserName: "chromium", viewport: { width: 1440, height: 900 } },
    },
  ],
});
