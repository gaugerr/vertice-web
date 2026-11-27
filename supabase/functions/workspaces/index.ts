import { importJWK, SignJWT } from 'jose';
import { service } from '../_shared/http.ts';
import { workspaceHandler } from './handler.ts';
import { previewOrigin } from './deployment.ts';
let keyPromise: ReturnType<typeof importJWK> | undefined;
async function signingKey() {
  if (!keyPromise) {
    keyPromise = (async () => {
      const configured = Deno.env.get('WORKSPACE_SIGNING_JWK');
      const { data, error } = configured
        ? { data: JSON.parse(configured), error: null }
        : await service.rpc('workspace_signing_jwk');
      if (error || !data?.d) throw Error('Signing is not configured');
      return importJWK(data, 'ES256');
    })();
    keyPromise.catch(() => {
      keyPromise = undefined;
    });
  }
  return keyPromise;
}
Deno.serve((req) =>
  workspaceHandler(req, {
    enabled: Deno.env.get('WORKSPACES_ENABLED') !== 'false',
    allowedOrigins: (Deno.env.get('WORKSPACE_ALLOWED_ORIGINS') ?? previewOrigin)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    authenticate: async (token) => {
      const { data, error } = await service.auth.getUser(token);
      if (
        error ||
        !data.user?.email_confirmed_at ||
        !data.user.identities?.some(
          (i) => i.provider === 'google' && i.identity_data?.email_verified === true,
        )
      )
        return null;
      return { uid: data.user.id };
    },
    command: async (actor, action, input) => {
      if (action === 'list') {
        const claim = await service.rpc('access_license_check', { actor });
        if (claim.error) throw claim.error;
      }
      const { data, error } = await service.rpc('workspace_command', {
        p_actor: actor,
        p_action: action,
        p_input: input,
      });
      if (error) throw error;
      return data;
    },
    randomToken: () =>
      Array.from(crypto.getRandomValues(new Uint8Array(32)), (n) =>
        n.toString(16).padStart(2, '0'),
      ).join(''),
    hash: async (raw) =>
      Array.from(
        new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw))),
        (n) => n.toString(16).padStart(2, '0'),
      ).join(''),
    sign: async (actor, origin, access) => {
      const key = await signingKey();
      const now = Math.floor(Date.now() / 1000);
      return new SignJWT({
        workspaceId: access.workspace_id,
        generation: access.generation,
        kind: access.kind,
        writable: access.writable,
      })
        .setProtectedHeader({ alg: 'ES256', typ: 'JWT', kid: 'vertice-workspace-v1' })
        .setSubject(actor)
        .setIssuer(Deno.env.get('WORKSPACE_ISSUER') ?? Deno.env.get('SUPABASE_URL')!)
        .setAudience(origin)
        .setIssuedAt(now)
        .setExpirationTime(now + (access.kind === 'shared' ? 86400 : 604800))
        .sign(key);
    },
  }),
);
