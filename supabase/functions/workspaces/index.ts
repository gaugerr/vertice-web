import { importJWK, SignJWT } from 'jose';
import { service } from '../_shared/http.ts';
import { workspaceHandler } from './handler.ts';
Deno.serve((req) =>
  workspaceHandler(req, {
    enabled: Deno.env.get('WORKSPACES_ENABLED') === 'true',
    allowedOrigins: (Deno.env.get('WORKSPACE_ALLOWED_ORIGINS') ?? '')
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
      const jwk = JSON.parse(Deno.env.get('WORKSPACE_SIGNING_JWK') ?? 'null');
      if (!jwk?.d) throw Error('Signing is not configured');
      const key = await importJWK(jwk, 'ES256');
      const now = Math.floor(Date.now() / 1000);
      return new SignJWT({
        workspaceId: access.workspace_id,
        generation: access.generation,
        kind: access.kind,
        writable: access.writable,
      })
        .setProtectedHeader({ alg: 'ES256', typ: 'JWT', kid: 'vertice-workspace-v1' })
        .setSubject(actor)
        .setIssuer(Deno.env.get('ACCESS_ISSUER') ?? Deno.env.get('SUPABASE_URL')!)
        .setAudience(origin)
        .setIssuedAt(now)
        .setExpirationTime(now + (access.kind === 'shared' ? 86400 : 604800))
        .sign(key);
    },
  }),
);
