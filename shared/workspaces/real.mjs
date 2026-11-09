import { createClient } from '@supabase/supabase-js';
import { HttpWorkspaceTransport } from './http.mjs';
import { validateConnection } from './connection.mjs';
export async function stagingEnvironment() {
  let config;
  try {
    const response = await fetch('/staging-config.json', { cache: 'no-store' });
    config = await response.json();
    localStorage.setItem('vertice_staging_public_config', JSON.stringify(config));
  } catch {
    config = JSON.parse(
      localStorage.getItem('vertice_staging_public_config') ?? '{"enabled":false}',
    );
  }
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
  const client = createClient(config.url, config.publishableKey, {
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
    if (error) throw Error('Não foi possível concluir o login de homologação.');
    const u = new URL(location.href);
    u.searchParams.delete('code');
    u.hash = sessionStorage.getItem('vertice_staging_invite_hash') ?? u.hash;
    history.replaceState({}, '', u);
    sessionStorage.removeItem('vertice_staging_invite_hash');
  }
  const { data: cached } = await client.auth.getSession();
  const { data, error } = cached.session
    ? await client.auth.getUser()
    : { data: { user: null }, error: null };
  let user = data.user;
  if (!user && (!navigator.onLine || error?.name === 'AuthRetryableFetchError'))
    user = (await client.auth.getSession()).data.session?.user;
  const transport = new HttpWorkspaceTransport({
    client,
    endpoint: config.endpoint,
    publicKey: config.publicKey,
    issuer: config.issuer,
    audience: location.origin,
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
      await client.auth.signOut({ scope: 'local' });
      sessionStorage.removeItem('vertice_staging_invite_hash');
      location.assign('/staging/');
    },
  };
}
