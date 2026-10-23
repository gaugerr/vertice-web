import {
  closeTestSession,
  LocalAccessError,
  signedBrowserState,
  signInTestUser,
} from '../e2e/support/access.ts';

const auth = await signInTestUser();
try {
  const deadline = Date.now() + 30000;
  let ready = false;
  while (Date.now() < deadline) {
    try {
      await signedBrowserState(auth);
      ready = true;
      break;
    } catch (error) {
      if (error instanceof LocalAccessError && [401, 403].includes(error.status)) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
  if (!ready) throw new Error('Isolated license functions did not become ready.');
  console.log('Local license functions and signing key verified. No shared session saved.');
} finally {
  await closeTestSession(auth);
}
