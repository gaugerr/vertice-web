import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  signOut: vi.fn(),
  call: vi.fn(),
  verify: vi.fn(),
}));
vi.mock('./config', () => ({
  accessConfigured: true,
  accessConfig: { url: 'https://test.supabase.co', publicKey: {} },
  accessNamespace: 'test:access',
}));
vi.mock('./client', () => ({
  getClient: () => ({
    auth: {
      getSession: mocks.getSession,
      onAuthStateChange: mocks.onAuthStateChange,
      signOut: mocks.signOut,
    },
  }),
  callAccess: mocks.call,
  AccessHttpError: class extends Error {
    constructor(
      public status: number,
      message: string,
    ) {
      super(message);
    }
  },
}));
vi.mock('./lease', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./lease')>()),
  verifyLease: mocks.verify,
}));
const uid = '83ec6841-7434-4dde-bd1d-490d35519d87';
const account = { uid, email: 'buyer@example.com' };
let controller: (typeof import('./controller'))['accessController'];
let callback: (event: string, session: null) => void;
beforeEach(async () => {
  vi.resetModules();
  localStorage.clear();
  vi.useFakeTimers({
    toFake: ['Date', 'setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'],
  });
  vi.setSystemTime(new Date('2026-10-21T12:00:00Z'));
  mocks.getSession.mockReset().mockResolvedValue({
    data: { session: { access_token: 'auth-token', user: { id: uid, email: account.email } } },
    error: null,
  });
  mocks.onAuthStateChange.mockReset().mockImplementation((fn) => {
    callback = fn;
    return { data: { subscription: { unsubscribe: vi.fn() } } };
  });
  mocks.signOut.mockReset().mockImplementation(async () => {
    callback('SIGNED_OUT', null);
    return { error: null };
  });
  mocks.call.mockReset().mockImplementation(async () => ({
    status: 'active',
    lease: 'signed',
    serverTime: Math.floor(Date.now() / 1000),
  }));
  mocks.verify.mockReset().mockImplementation(async () => ({
    uid,
    email: account.email,
    licenseId: 'license',
    version: 1,
    issuedAt: Date.now(),
    expiresAt: Date.now() + 604800000,
  }));
  controller = (await import('./controller')).accessController;
});
afterEach(() => {
  controller.stop();
  vi.useRealTimers();
  localStorage.clear();
});
async function start() {
  await controller.start();
  await controller.refresh(true);
}
describe('access lifecycle', () => {
  it('keeps a verified lease through a network outage and blocks new work at expiry', async () => {
    await start();
    expect(controller.canUse(uid)).toBe(true);
    mocks.call.mockRejectedValue(new TypeError('offline'));
    await controller.refresh(true);
    expect(controller.canUse(uid)).toBe(true);
    vi.setSystemTime(Date.now() + 604800001);
    await vi.advanceTimersByTimeAsync(1000);
    expect(controller.canUse(uid)).toBe(false);
    expect(controller.snapshot().phase).toBe('expired');
    expect(controller.canExport(uid)).toBe(true);
  });
  it('removes a confirmed revoked lease and denies export, while retaining committed data outside auth state', async () => {
    await start();
    mocks.call.mockResolvedValue({ status: 'revoked' });
    await controller.refresh(true);
    expect(controller.snapshot().phase).toBe('denied');
    expect(controller.canUse(uid)).toBe(false);
    expect(controller.canExport(uid)).toBe(false);
    expect(localStorage.getItem('test:access:lease')).toBeNull();
  });
  it('permits a cached offline authorization when the Supabase session cannot refresh', async () => {
    localStorage.setItem(
      'test:access:lease',
      JSON.stringify({ account, token: 'signed', highWater: Date.now() }),
    );
    mocks.getSession.mockRejectedValue(new TypeError('offline'));
    await start();
    expect(controller.canUse(uid)).toBe(true);
  });
  it('discards an old in-flight license response after logout', async () => {
    await start();
    let finish!: (value: unknown) => void;
    mocks.call.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const pending = controller.refresh(true);
    await Promise.resolve();
    await controller.logout();
    finish({ status: 'active', lease: 'signed', serverTime: Math.floor(Date.now() / 1000) });
    await pending;
    expect(controller.canUse(uid)).toBe(false);
    expect(controller.snapshot().phase).toBe('signedout');
  });
  it('cannot restore a logged-out account from a stale getSession response', async () => {
    await start();
    let finish!: (value: unknown) => void;
    mocks.getSession.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const pending = controller.refresh(true);
    await controller.logout();
    finish({
      data: { session: { access_token: 'stale', user: { id: uid, email: account.email } } },
      error: null,
    });
    await pending;
    expect(controller.snapshot().phase).toBe('signedout');
    expect(controller.canUse(uid)).toBe(false);
  });
  it('freezes old-account operations immediately when another tab changes the cached account', async () => {
    await start();
    mocks.verify.mockImplementationOnce(async () => ({
      uid: 'other',
      email: 'other@example.com',
      licenseId: 'other-license',
      version: 1,
      issuedAt: Date.now(),
      expiresAt: Date.now() + 604800000,
    }));
    localStorage.setItem(
      'test:access:lease',
      JSON.stringify({
        account: { uid: 'other', email: 'other@example.com' },
        token: 'other-signed',
        highWater: Date.now(),
      }),
    );
    window.dispatchEvent(new StorageEvent('storage', { key: 'test:access:lease' }));
    expect(controller.canUse(uid)).toBe(false);
    await Promise.resolve();
    await Promise.resolve();
    expect(controller.snapshot().account?.uid).toBe('other');
    expect(controller.canExport(uid)).toBe(false);
  });
});
