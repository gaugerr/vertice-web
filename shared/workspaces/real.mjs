import { createClient } from '@supabase/supabase-js';
import { HttpWorkspaceTransport } from './http.mjs';
import { boundedFetch } from './network.mjs';
import { WorkspaceError } from './core.mjs';
import { validateConnection } from './connection.mjs';
export async function stagingEnvironment() {
  const readJSON = (key) => {
    try {
      return JSON.parse(localStorage.getItem(key));
    } catch {
      return null;
    }
  };
  async function loadConfig() {
    const response = await boundedFetch('/staging-config.json', { cache: 'no-store' });
    if (!response.ok) throw Error('Configuração indisponível.');
    const next = await response.json();
    if (next.enabled) validateConnection(next, location.origin);
    localStorage.setItem('vertice_staging_public_config', JSON.stringify(next));
    return next;
  }
  const cachedConfig = readJSON('vertice_staging_public_config');
  let config = cachedConfig;
  if (!config) {
    try {
      config = await loadConfig();
    } catch {
      config = { enabled: false };
    }
  } else void loadConfig().catch(() => {});
  if (!config.enabled) return { mode: 'staging', actor: null, transport: null, configured: false };
  let url;
  try {
    ({ url } = validateConnection(config, location.origin));
  } catch (error) {
    return {
      mode: 'staging',
      actor: null,
      transport: null,
      configured: false,
      connectionError: error.message,
    };
  }
  const persisted = readJSON('vertice_workspace_staging_auth')?.user;
  const candidate =
    localStorage.getItem('vertice_workspace_signed_out') === persisted?.id ? null : persisted;
  const client = createClient(config.url, config.publishableKey, {
    global: { fetch: boundedFetch },
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      flowType: 'pkce',
      storageKey: 'vertice_workspace_staging_auth',
    },
  });
  const code = new URL(location.href).searchParams.get('code');
  if (code) {
    const { error } = await client.auth.exchangeCodeForSession(code);
    if (error) throw Error('Não foi possível concluir o login com Google.');
    localStorage.removeItem('vertice_workspace_signed_out');
    const u = new URL(location.href);
    u.searchParams.delete('code');
    u.hash = sessionStorage.getItem('vertice_staging_invite_hash') ?? u.hash;
    history.replaceState({}, '', u);
    sessionStorage.removeItem('vertice_staging_invite_hash');
  }
  let user = candidate;
  const invalidate = () => window.dispatchEvent(new Event('vertice:workspace-auth-invalid'));
  client.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT' || (event === 'SIGNED_IN' && user && session?.user.id !== user.id))
      invalidate();
  });
  window.addEventListener('storage', (event) => {
    if (
      (event.key === 'vertice_workspace_signed_out' && event.newValue === user?.id) ||
      (event.key === 'vertice_workspace_staging_auth' && !event.newValue)
    )
      invalidate();
  });
  let verification;
  const verifyIdentity = () =>
    (verification ??= (async () => {
      const { data: session, error: sessionError } = await client.auth.getSession();
      if (sessionError) {
        if ([400, 401, 403].includes(sessionError.status))
          throw new WorkspaceError('unauthorized', 'Entre novamente com sua conta Google.');
        throw sessionError;
      }
      if (!session.session)
        throw new WorkspaceError('unauthorized', 'Entre novamente com sua conta Google.');
      const { data, error } = await client.auth.getUser();
      if (error) {
        if ([400, 401, 403].includes(error.status))
          throw new WorkspaceError('unauthorized', 'Entre novamente com sua conta Google.');
        throw error;
      }
      if (!data.user || (user && data.user.id !== user.id))
        throw new WorkspaceError('unauthorized', 'Sua conta mudou. Entre novamente.');
      user = data.user;
      return user;
    })().catch((error) => {
      verification = null;
      throw error;
    }));
  if (code) user = await verifyIdentity();
  const transport = new HttpWorkspaceTransport({
    client,
    endpoint: config.endpoint,
    publicKey: config.publicKey,
    issuer: config.issuer,
    audience: location.origin,
    sessionAllowed: () =>
      Boolean(
        user &&
          readJSON('vertice_workspace_staging_auth')?.user?.id === user.id &&
          localStorage.getItem('vertice_workspace_signed_out') !== user.id,
      ),
  });
  return {
    mode: 'staging',
    connectionMode: config.connectionMode,
    project: 'staging_' + url.hostname.split('.')[0],
    configured: true,
    actor: user
      ? {
          uid: user.id,
          email: user.email ?? '',
          name:
            user.identities?.find((i) => i.provider === 'google')?.identity_data?.full_name ??
            user.email,
          licensed: false,
        }
      : null,
    transport,
    verifyIdentity,
    login: async () => {
      if (location.hash.startsWith('#convite?'))
        sessionStorage.setItem('vertice_staging_invite_hash', location.hash);
      const { error } = await client.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: location.origin + '/staging/', scopes: 'openid email profile' },
      });
      if (error) throw Error('Não foi possível abrir o login Google.');
    },
    logout: async () => {
      if (user) localStorage.setItem('vertice_workspace_signed_out', user.id);
      invalidate();
      await client.auth.signOut({ scope: 'local' });
      sessionStorage.removeItem('vertice_staging_invite_hash');
      location.assign('/staging/');
    },
  };
}
