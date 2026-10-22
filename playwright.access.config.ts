import { defineConfig } from '@playwright/test';
import base from './playwright.config';
export default defineConfig({
  ...base,
  testDir: './e2e-access',
  projects: [
    {
      name: 'access-chromium',
      use: { browserName: 'chromium', viewport: { width: 390, height: 844 } },
    },
  ],
  use: { ...base.use, storageState: { cookies: [], origins: [] } },
});
