import { test, expect } from 'vitest';
import { validateConnection, CONNECTED_ORIGIN, CONNECTED_PROJECT } from './connection.mjs';
const config = () => ({
  url: `https://${CONNECTED_PROJECT}.supabase.co`,
  endpoint: `https://${CONNECTED_PROJECT}.supabase.co/functions/v1/workspaces`,
  connectionMode: 'existing-project-preview',
  projectRef: CONNECTED_PROJECT,
  allowedOrigin: CONNECTED_ORIGIN,
  publicKey: { kty: 'EC', crv: 'P-256', x: 'x', y: 'y' },
});
test('conexão ao banco existente exige configuração explícita e origem exata', () => {
  expect(validateConnection(config(), CONNECTED_ORIGIN).url.hostname).toBe(
    CONNECTED_PROJECT + '.supabase.co',
  );
  for (const origin of [
    'https://app.usevertice.app.br',
    'http://127.0.0.1:5196',
    'https://preview-controle-financeiro.vertice-financeiro-preview.pages.dev.evil.test',
  ])
    expect(() => validateConnection(config(), origin)).toThrow();
  for (const field of ['connectionMode', 'projectRef', 'allowedOrigin']) {
    const c = config();
    delete c[field];
    expect(() => validateConnection(c, CONNECTED_ORIGIN)).toThrow();
  }
});
test('endpoint cruzado, protocolo inseguro e chave privada são recusados', () => {
  for (const change of [
    { endpoint: 'https://other.supabase.co/functions/v1/workspaces' },
    { url: 'http://' + CONNECTED_PROJECT + '.supabase.co' },
    { endpoint: config().endpoint + '-evil' },
    { publicKey: { ...config().publicKey, d: 'private' } },
  ])
    expect(() => validateConnection({ ...config(), ...change }, CONNECTED_ORIGIN)).toThrow();
});
