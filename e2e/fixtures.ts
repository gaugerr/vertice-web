import { test as base } from '@playwright/test';
import { closeTestSession, signedBrowserState, signInTestUser } from './support/access';

export const test = base.extend({
  storageState: async ({ storageState }, use) => {
    if (process.env.ACCESS_INTEGRATION !== '1') {
      await use(storageState);
      return;
    }
    const auth = await signInTestUser();
    try {
      await use(await signedBrowserState(auth));
    } finally {
      await closeTestSession(auth);
    }
  },
});

export { expect } from '@playwright/test';
export type { Page, Locator } from '@playwright/test';
