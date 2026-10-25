import type { Session } from '@supabase/supabase-js';
import { accessConfig, accessConfigured, accessNamespace } from './config';
import { AccessHttpError, callAccess, getClient } from './client';
import { usableUntil, verifyLease, type Account, type VerifiedLease } from './lease';
import { waitForWrites } from '../data/database/writes';
export interface AccessState {
  phase: 'loading' | 'signedout' | 'active' | 'expired' | 'denied' | 'error';
  account: Account | null;
  lease: VerifiedLease | null;
  message: string;
  busy: boolean;
  adminUid: string | null;
}
interface Cache {
  account: Account;
  token: string;
  highWater: number;
}
const cacheKey = `${accessNamespace}:lease`;
const clockKey = `${accessNamespace}:clock`;
let state: AccessState = {
  phase: 'loading',
  account: null,
  lease: null,
  message: '',
  busy: false,
  adminUid: null,
};
const listeners = new Set<() => void>();
let started = false;
let inFlight: Promise<void> | null = null;
let lastAttempt = 0;
let generation = 0;
let baseline = { wall: Date.now(), monotonic: performance.now() };
let highWater = 0;
let activeToken = '';
let cleanup: (() => void) | null = null;
function emit(patch: Partial<AccessState>) {
  state = { ...state, ...patch };
  listeners.forEach((fn) => fn());
}
function config() {
  return {
    publicKey: accessConfig.publicKey,
    issuer: accessConfig.url,
    audience: window.location.origin,
  };
}
function storageRead(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function storageRemove(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* fail closed in memory */
  }
}
function floor() {
  return baseline.wall + performance.now() - baseline.monotonic;
}
function usable() {
  return Boolean(state.lease && usableUntil(state.lease.expiresAt, Date.now(), highWater, floor()));
}
function save(cache: Cache) {
  localStorage.setItem(cacheKey, JSON.stringify(cache));
  localStorage.setItem(clockKey, String(cache.highWater));
}
async function restoreCache() {
  const seq = ++generation;
  try {
    const source = storageRead(cacheKey);
    if (!source || source.length > 12000) throw new Error();
    const cache = JSON.parse(source) as Cache;
    if (!cache.account?.uid || !Number.isFinite(cache.highWater)) throw new Error();
    const lease = await verifyLease(cache.token, cache.account, config(), Date.now(), true);
    if (seq !== generation) return;
    highWater = Math.max(cache.highWater, Number(storageRead(clockKey)) || 0);
    baseline = { wall: Date.now(), monotonic: performance.now() };
    activeToken = cache.token;
    emit({
      account: { uid: lease.uid, email: lease.email },
      adminUid: state.adminUid === lease.uid ? lease.uid : null,
      lease,
      phase: usableUntil(lease.expiresAt, Date.now(), highWater, floor()) ? 'active' : 'expired',
      message: '',
    });
  } catch {
    if (seq !== generation) return;
    activeToken = '';
    emit({ account: null, lease: null, phase: 'signedout', message: '', adminUid: null });
  }
}
function invalidate(
  phase: 'signedout' | 'denied',
  account: Account | null = null,
  message?: string,
) {
  generation++;
  activeToken = '';
  storageRemove(cacheKey);
  emit({
    phase,
    account,
    adminUid: null,
    lease: null,
    message:
      phase === 'denied'
        ? (message ??
          'Seu acesso está aguardando a validação da compra. Assim que a confirmação for concluída, ele será liberado.')
        : '',
    busy: false,
  });
}
async function performRefresh() {
  if (!accessConfigured) {
    emit({ phase: 'error', message: 'O acesso Google ainda não foi configurado.' });
    return;
  }
  let requestGeneration = generation;
  emit({ busy: true });
  try {
    const { data, error } = await getClient().auth.getSession();
    if (requestGeneration !== generation) return;
    if (error) throw error;
    const session = data.session;
    if (!session) {
      if (!usable()) emit({ phase: state.account ? 'expired' : 'signedout' });
      return;
    }
    const uid = session.user.id;
    if (state.account?.uid !== uid) {
      generation++;
      activeToken = '';
      storageRemove(cacheKey);
      emit({
        account: { uid, email: session.user.email ?? '' },
        lease: null,
        phase: 'loading',
        adminUid: null,
      });
    }
    requestGeneration = generation;
    const response = await callAccess<{
      status: string;
      lease?: string;
      serverTime?: number;
      admin?: boolean;
    }>('license-check', {}, session.access_token);
    if (requestGeneration !== generation) return;
    if (response.status === 'absent' || response.status === 'revoked') {
      invalidate(
        'denied',
        state.account,
        response.status === 'revoked'
          ? 'Seu acesso está pausado. Fale com o produtor para conferir a situação da sua compra.'
          : undefined,
      );
      return;
    }
    if (response.status !== 'active' || !response.lease || !Number.isFinite(response.serverTime))
      throw new Error('Resposta inválida.');
    if (Math.abs(Date.now() - response.serverTime! * 1000) > 60000)
      throw new Error('Ajuste a data e hora do aparelho para validar o acesso.');
    const lease = await verifyLease(response.lease, state.account!, config());
    if (requestGeneration !== generation) return;
    const account = { uid, email: lease.email };
    highWater = Date.now();
    baseline = { wall: highWater, monotonic: performance.now() };
    save({ account, token: response.lease, highWater });
    activeToken = response.lease;
    emit({
      account,
      lease,
      phase: 'active',
      message: '',
      adminUid: response.admin === true ? uid : null,
    });
  } catch (error) {
    if (requestGeneration !== generation) return;
    if (error instanceof AccessHttpError && (error.status === 401 || error.status === 403)) {
      invalidate('signedout');
      emit({ message: error.message });
    } else
      emit({
        phase: usable() ? 'active' : state.account ? 'expired' : 'error',
        message:
          error instanceof Error && error.message.includes('data e hora')
            ? error.message
            : 'Sem conexão com a validação. Seu acesso offline continua até a data autorizada.',
      });
  } finally {
    emit({ busy: false });
  }
}
export const accessController = {
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
  snapshot() {
    return state;
  },
  canUse(uid: string) {
    return (
      state.account?.uid === uid && state.phase === 'active' && usable() && Boolean(activeToken)
    );
  },
  canExport(uid: string) {
    return (
      state.account?.uid === uid &&
      Boolean(state.lease) &&
      (state.phase === 'active' || state.phase === 'expired')
    );
  },
  async refresh(force = false) {
    if (inFlight) return inFlight;
    if (!force && Date.now() - lastAttempt < 60000) return;
    lastAttempt = Date.now();
    inFlight = performRefresh().finally(() => {
      inFlight = null;
      if (state.phase === 'loading')
        queueMicrotask(() => {
          void this.refresh(true);
        });
    });
    return inFlight;
  },
  async start() {
    if (started) return;
    started = true;
    if (!accessConfigured) {
      emit({ phase: 'error', message: 'O acesso Google ainda não foi configurado.' });
      return;
    }
    await restoreCache();
    void this.refresh();
    const { data } = getClient().auth.onAuthStateChange((event, session: Session | null) => {
      if (event === 'SIGNED_OUT') invalidate('signedout');
      else if (session && state.account?.uid !== session.user.id) {
        generation++;
        activeToken = '';
        storageRemove(cacheKey);
        emit({
          account: { uid: session.user.id, email: session.user.email ?? '' },
          lease: null,
          phase: 'loading',
          adminUid: null,
        });
        setTimeout(() => {
          void this.refresh(true);
        }, 0);
      }
    });
    const tick = () => {
      if (state.phase === 'active' && !usable())
        emit({ phase: 'expired', message: 'Conecte à internet para renovar seu acesso.' });
      highWater = Math.max(highWater, Date.now(), floor());
    };
    const foreground = () => {
      if (document.visibilityState === 'visible') {
        tick();
        void this.refresh();
      }
    };
    const online = () => {
      void this.refresh();
    };
    const storage = (event: StorageEvent) => {
      if (event.key === cacheKey) {
        let sameAccount = false;
        try {
          sameAccount = JSON.parse(event.newValue ?? 'null')?.account?.uid === state.account?.uid;
        } catch {
          /* invalid cache must block */
        }
        // A verified renewal for the same identity must not open a modal or steal
        // the keyboard from another tab. Switches and logout freeze immediately.
        if (!sameAccount || !usable()) emit({ phase: 'loading' });
        void restoreCache();
      }
    };
    const timer = setInterval(tick, 1000);
    const renewal = setInterval(foreground, 15 * 60000);
    const clock = setInterval(() => {
      if (state.lease) {
        try {
          localStorage.setItem(clockKey, String(highWater));
        } catch {
          /* no authorization extension */
        }
      }
    }, 30000);
    window.addEventListener('online', online);
    window.addEventListener('focus', foreground);
    window.addEventListener('storage', storage);
    document.addEventListener('visibilitychange', foreground);
    cleanup = () => {
      data.subscription.unsubscribe();
      clearInterval(timer);
      clearInterval(renewal);
      clearInterval(clock);
      window.removeEventListener('online', online);
      window.removeEventListener('focus', foreground);
      window.removeEventListener('storage', storage);
      document.removeEventListener('visibilitychange', foreground);
    };
  },
  async logout() {
    await waitForWrites();
    invalidate('signedout');
    await getClient().auth.signOut({ scope: 'local' });
  },
  stop() {
    cleanup?.();
    cleanup = null;
    started = false;
  },
};
