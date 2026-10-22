import { defineConfig } from '@playwright/test';
import config from './playwright.config';

export default defineConfig({
  ...config,
  testDir: './e2e-hosted',
  use: {
    ...config.use,
    storageState: { cookies: [], origins: [] },
    baseURL: process.env.VERTICE_BASE_URL ?? 'https://use-vertice.vercel.app',
  },
  webServer: undefined,
});
