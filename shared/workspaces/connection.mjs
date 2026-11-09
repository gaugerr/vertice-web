export const CONNECTED_PROJECT = 'wqutcsjdozcukwxvkbtc';
export const CONNECTED_ORIGIN =
  'https://preview-controle-financeiro.vertice-financeiro-preview.pages.dev';
export function validateConnection(config, origin) {
  const url = new URL(config.url);
  const endpoint = new URL(config.endpoint);
  if (
    url.protocol !== 'https:' ||
    !url.hostname.endsWith('.supabase.co') ||
    url.pathname !== '/' ||
    endpoint.origin !== url.origin ||
    endpoint.pathname !== '/functions/v1/workspaces'
  )
    throw Error('Configuração de sincronização inválida.');
  if (url.hostname === CONNECTED_PROJECT + '.supabase.co') {
    if (
      config.connectionMode !== 'existing-project-preview' ||
      config.projectRef !== CONNECTED_PROJECT ||
      config.allowedOrigin !== CONNECTED_ORIGIN ||
      origin !== CONNECTED_ORIGIN
    )
      throw Error('A conexão ao banco Vértice está liberada somente na preview autorizada.');
  }
  const jwk = config.publicKey;
  if (!jwk || jwk.d || jwk.kty !== 'EC' || jwk.crv !== 'P-256' || !jwk.x || !jwk.y)
    throw Error('A chave pública da sincronização é inválida.');
  return { url, endpoint };
}
