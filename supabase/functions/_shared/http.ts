import { createClient } from '@supabase/supabase-js';

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function response(req: Request, body: unknown, status = 200): Response {
  const origin = req.headers.get('origin') ?? '';
  const allowed = (Deno.env.get('ACCESS_ALLOWED_ORIGINS') ?? '').split(',').map((s) => s.trim());
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      Vary: 'Origin',
      ...(allowed.includes(origin) ? { 'Access-Control-Allow-Origin': origin } : {}),
      'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    },
  });
}
export async function serve(
  req: Request,
  handler: (userId: string, origin: string) => Promise<unknown>,
) {
  try {
    const origin = req.headers.get('origin') ?? '';
    const allowed = (Deno.env.get('ACCESS_ALLOWED_ORIGINS') ?? '').split(',').map((s) => s.trim());
    if (!origin || !allowed.includes(origin)) throw new HttpError(403, 'Origin not allowed');
    if (req.method === 'OPTIONS') return response(req, { ok: true });
    if (req.method !== 'POST') throw new HttpError(405, 'POST required');
    const authorization = req.headers.get('authorization');
    if (!authorization?.startsWith('Bearer ')) throw new HttpError(401, 'Sign in required');
    const { data, error } = await service.auth.getUser(authorization.slice(7));
    if (error || !data.user) throw new HttpError(401, 'Sign in again');
    // getUser verifies the token; identity_data is provider-owned, not user_metadata.
    const google = data.user.identities?.find(
      (i) => i.provider === 'google' && i.identity_data?.email_verified === true,
    );
    if (!google || !data.user.email_confirmed_at)
      throw new HttpError(403, 'Verified Google account required');
    return response(req, await handler(data.user.id, origin));
  } catch (error) {
    return response(
      req,
      { error: error instanceof HttpError ? error.message : 'Service temporarily unavailable' },
      error instanceof HttpError ? error.status : 503,
    );
  }
}
export const service = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  {
    auth: { persistSession: false, autoRefreshToken: false },
  },
);
