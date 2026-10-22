import publicKey from './license-public-key.json';
export const accessConfig = {
  enforced: import.meta.env.VITE_ACCESS_MODE === 'enforced',
  url: (import.meta.env.VITE_SUPABASE_URL ?? '').replace(/\/$/, ''),
  key: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '',
  publicKey,
};
export const accessConfigured = Boolean(accessConfig.url && accessConfig.key && 'x' in publicKey);
export const accessNamespace = `vertice:access:${accessConfig.url || 'unconfigured'}`;
