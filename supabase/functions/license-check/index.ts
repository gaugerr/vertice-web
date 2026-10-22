import { importJWK, SignJWT } from 'jose';
import { HttpError, serve, service } from '../_shared/http.ts';

Deno.serve((req) =>
  serve(req, async (userId, origin) => {
    const { data, error } = await service.rpc('access_license_check', { actor: userId });
    if (error) throw new HttpError(error.code === '28000' ? 403 : 503, 'Unable to verify access');
    if (data.status !== 'active') return { status: data.status };
    const privateJwk = JSON.parse(Deno.env.get('LICENSE_SIGNING_JWK') ?? 'null');
    if (!privateJwk?.d) throw new HttpError(503, 'Access signing is not configured');
    const key = await importJWK(privateJwk, 'ES256');
    const now = Math.floor(Date.now() / 1000);
    const lease = await new SignJWT({
      licenseId: data.id,
      version: data.version,
      email: data.email,
    })
      .setProtectedHeader({ alg: 'ES256', typ: 'JWT', kid: 'vertice-access-v1' })
      .setSubject(userId)
      .setIssuer(Deno.env.get('ACCESS_ISSUER') ?? Deno.env.get('SUPABASE_URL')!)
      .setAudience(origin)
      .setIssuedAt(now)
      .setExpirationTime(now + 604800)
      .sign(key);
    return { status: 'active', lease, serverTime: now, admin: data.admin };
  }),
);
