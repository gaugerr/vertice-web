import { createClient } from '@supabase/supabase-js';
import { accessConfig, accessConfigured } from './config';
let client: ReturnType<typeof createClient> | null = null;
export function getClient() {
  if (!accessConfigured) throw new Error('O acesso Google ainda não foi configurado.');
  return (client ??= createClient(accessConfig.url, accessConfig.key, {
    auth: {
      flowType: 'pkce',
      detectSessionInUrl: false,
      persistSession: true,
      autoRefreshToken: true,
    },
  }));
}
const exchanges = new Map<
  string,
  ReturnType<ReturnType<typeof getClient>['auth']['exchangeCodeForSession']>
>();
export async function exchangeCode(code: string) {
  let result = exchanges.get(code);
  if (!result) {
    result = getClient().auth.exchangeCodeForSession(code);
    exchanges.set(code, result);
  }
  return result;
}
export function safeReturnPath(value: string | null): string {
  if (
    !value?.startsWith('/') ||
    value.startsWith('//') ||
    value.includes('\\') ||
    [...value].some((c) => c.charCodeAt(0) < 32)
  )
    return '/';
  try {
    const url = new URL(value, window.location.origin);
    return url.origin === window.location.origin && !/^\/(auth|login)/.test(url.pathname)
      ? url.pathname + url.search + url.hash
      : '/';
  } catch {
    return '/';
  }
}
export async function signIn() {
  await import('../data/database/writes').then((m) => m.waitForWrites());
  const { error } = await getClient().auth.signInWithOAuth({
    provider: 'google',
    options: {
      scopes: 'openid email profile',
      redirectTo: `${window.location.origin}/auth/callback`,
      queryParams: { prompt: 'select_account' },
    },
  });
  if (error) throw error;
}
export async function callAccess<T>(endpoint: string, input: unknown, token: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(`${accessConfig.url}/functions/v1/${endpoint}`, {
      method: 'POST',
      cache: 'no-store',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: accessConfig.key,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    });
    if (response.status === 401) throw new AccessHttpError(401, 'Entre novamente com o Google.');
    if (!response.ok)
      throw new AccessHttpError(
        response.status,
        response.status === 403
          ? 'Acesso não autorizado.'
          : 'Não foi possível concluir. Verifique os dados e tente novamente.',
      );
    return (await response.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}
export class AccessHttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
