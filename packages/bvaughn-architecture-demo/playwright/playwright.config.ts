import { FullConfig } from "@playwright/test";

const { CI, RECORD_PROTOCOL_DATA, RECORD_VIDEO, VISUAL_DEBUG } = process.env;

const slowMo = VISUAL_DEBUG ? 250 : 10;

const config: FullConfig = {
  forbidOnly: !!CI,
  globalSetup: require.resolve("./playwright.globalSetup"),
  // @ts-ignore
  reporter: CI ? "github" : "list",
  retries: VISUAL_DEBUG || RECORD_PROTOCOL_DATA ? 0 : 5,
  snapshotDir: "./snapshots",
  use: {
    browserName: "chromium",
    launchOptions: {
      slowMo,
    },
    trace: "on-first-retry",
    video: RECORD_VIDEO ? "on" : "off",
    viewport: {
      width: 1024,
      height: 600,
    },
  },
  testDir: __dirname,
  testMatch: ["tests/**/*.ts"],
  timeout: 30_000,
};

if (VISUAL_DEBUG || RECORD_PROTOCOL_DATA) {
  config.workers = 1;
}

export default config;
