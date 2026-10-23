import { readFileSync } from 'node:fs';
export function validateAccess(env) {
  const mode = env.VITE_ACCESS_MODE ?? 'legacy';
  if (env.CF_PAGES === '1' && mode !== 'enforced')
    throw new Error('Cloudflare Pages requires enforced access. Use tools/build-cloudflare.mjs.');
  if (!['legacy', 'enforced'].includes(mode)) throw new Error('Invalid VITE_ACCESS_MODE');
  if (mode === 'enforced') {
    if (!/^https?:\/\//.test(env.VITE_SUPABASE_URL ?? '') || !env.VITE_SUPABASE_PUBLISHABLE_KEY)
      throw new Error('Enforced access requires Supabase URL and publishable key.');
    const publicKey = JSON.parse(
      readFileSync(new URL('../src/access/license-public-key.json', import.meta.url), 'utf8'),
    );
    if (
      publicKey.kty !== 'EC' ||
      publicKey.crv !== 'P-256' ||
      !publicKey.x ||
      !publicKey.y ||
      publicKey.d
    )
      throw new Error('A public ES256 verification key is required.');
    const key = env.VITE_SUPABASE_PUBLISHABLE_KEY;
    if (!key.startsWith('sb_publishable_')) {
      try {
        if (JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role !== 'anon')
          throw new Error();
      } catch {
        throw new Error('Use the publishable key or legacy anon key only.');
      }
    }
    if (/service_role|sb_secret_/.test(env.VITE_SUPABASE_PUBLISHABLE_KEY))
      throw new Error('A public key is required.');
  }
}
