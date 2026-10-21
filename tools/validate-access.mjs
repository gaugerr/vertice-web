export function validateAccess(env) {
  const mode = env.VITE_ACCESS_MODE ?? 'legacy';
  if (!['legacy', 'enforced'].includes(mode)) throw new Error('Invalid VITE_ACCESS_MODE');
  if (mode === 'enforced') {
    if (!/^https?:\/\//.test(env.VITE_SUPABASE_URL ?? '') || !env.VITE_SUPABASE_PUBLISHABLE_KEY)
      throw new Error('Enforced access requires Supabase URL and publishable key.');
    if (/service_role|sb_secret_/.test(env.VITE_SUPABASE_PUBLISHABLE_KEY))
      throw new Error('A public key is required.');
  }
}
