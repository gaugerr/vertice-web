// Local Supabase only. These fixtures must never contact a hosted project.
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';

const status = JSON.parse(await readFile('/tmp/vertice-supabase-status.json', 'utf8'));
assert.equal(status.API_URL, 'http://127.0.0.1:54321', 'Only isolated local Supabase is allowed');
const endpoint = `${status.API_URL}/functions/v1/cakto-webhook`;
const secret = 'local-only-cakto-integration-fixture-secret';
const order = {
  id: 'local-cakto-order',
  status: 'paid',
  product: { id: 'local-cakto-product' },
  customer: { email: 'local-cakto-buyer@example.test', docNumber: 'must-not-store' },
  createdAt: '2026-10-25T12:00:00Z',
  paidAt: '2026-10-25T12:01:00Z',
};

function query(sql) {
  return execFileSync(
    'docker',
    [
      'exec',
      'supabase_db_vertice_access_test',
      'psql',
      '-U',
      'postgres',
      '-d',
      'postgres',
      '-v',
      'ON_ERROR_STOP=1',
      '-Atc',
      sql,
    ],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  ).trim();
}

async function send(data, event = 'purchase_approved', valid = true) {
  const body = JSON.stringify({ secret, event, data });
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
  return fetch(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-cakto-timestamp': timestamp,
      'x-cakto-signature': `v1=${valid ? signature : '0'.repeat(64)}`,
    },
    body,
    signal: AbortSignal.timeout(10000),
  });
}

// An unsigned probe waits for Edge Runtime startup without creating an inbox record.
const deadline = Date.now() + 30000;
let ready = false;
while (Date.now() < deadline) {
  try {
    const response = await send(order, 'purchase_approved', false);
    if (response.status === 401) {
      ready = true;
      break;
    }
  } catch {
    /* Only retry local startup/connectivity failures. */
  }
  await new Promise((resolve) => setTimeout(resolve, 1000));
}
assert.equal(ready, true, 'Local Cakto capture function did not become ready');
const before = query('select count(*) from public.licenses');
assert.equal((await send(order)).status, 200);
assert.equal((await send(order)).status, 200);
assert.equal(
  query("select seen_count from access_private.cakto_events where order_id='local-cakto-order'"),
  '2',
);

assert.equal(
  (await send({ ...order, status: 'refunded', refundedAt: '2026-10-25T13:00:00Z' }, 'refund'))
    .status,
  200,
);
assert.equal(
  (
    await send([
      { ...order, id: 'local-cakto-order-two' },
      { ...order, id: 'local-cakto-foreign', product: { id: 'other-product' } },
    ])
  ).status,
  200,
);
assert.equal(
  (
    await send([
      { ...order, id: 'local-cakto-invalid-batch' },
      { ...order, customer: { email: 'invalid' } },
    ])
  ).status,
  400,
);
assert.equal(
  query("select count(*) from access_private.cakto_events where order_id like 'local-cakto-%'"),
  '3',
);
assert.equal(
  query("select count(*) from access_private.cakto_events where order_id='local-cakto-foreign'"),
  '0',
);
assert.equal(
  query('select count(*) from public.licenses'),
  before,
  'Capture must not alter licenses',
);

const denied = await fetch(`${status.API_URL}/rest/v1/rpc/cakto_capture_events`, {
  method: 'POST',
  headers: {
    apikey: status.ANON_KEY,
    Authorization: `Bearer ${status.ANON_KEY}`,
    'content-type': 'application/json',
  },
  body: JSON.stringify({ events: [] }),
  signal: AbortSignal.timeout(10000),
});
assert.ok([401, 403].includes(denied.status), 'Anonymous caller must not invoke capture RPC');
console.log('Local signed webhook → Edge Function → private inbox passed; no license changed.');
