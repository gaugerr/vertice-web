import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { test } from 'node:test';
import { createCaktoHandler, type CapturedEvent } from './handler.ts';

const secret = 'synthetic-cakto-webhook-secret-only-for-tests';
const now = Date.UTC(2026, 9, 25, 12);
const product = 'product-vertice-fixture';
const sent = String(Math.floor(now / 1000));

function order(overrides: Record<string, unknown> = {}) {
  return {
    id: 'order-fixture',
    status: 'paid',
    product: { id: product },
    offer: { id: 'offer-fixture' },
    customer: { email: ' Buyer+kit@Example.test ', docNumber: 'should-not-be-stored' },
    createdAt: '2026-10-25T08:00:00-03:00',
    paidAt: '2026-10-25T08:01:00-03:00',
    card: { lastDigits: '4242' },
    ...overrides,
  };
}

function envelope(data: unknown = order(), event = 'purchase_approved') {
  return { secret, event, data };
}

function signed(body: unknown, timestamp = sent) {
  const raw = typeof body === 'string' ? body : JSON.stringify(body);
  const signature = createHmac('sha256', secret).update(`${timestamp}.${raw}`).digest('hex');
  return new Request('https://example.test/cakto-webhook', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-cakto-timestamp': timestamp,
      'x-cakto-signature': `v1=${signature}`,
    },
    body: raw,
  });
}

function setup(overrides: Partial<Parameters<typeof createCaktoHandler>[0]> = {}) {
  const batches: CapturedEvent[][] = [];
  const handler = createCaktoHandler({
    enabled: true,
    secret,
    productIds: [product],
    now: () => now,
    capture: async (events) => {
      batches.push(events);
    },
    ...overrides,
  });
  return { batches, handler };
}

test('captures a signed V1 event with only the necessary normalized fields', async () => {
  const { handler, batches } = setup();
  const response = await handler(signed(envelope()));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('access-control-allow-origin'), null);
  assert.deepEqual(await response.json(), { received: true, mode: 'capture', ignored: false });
  assert.equal(batches.length, 1);
  const { event_key, ...record } = batches[0][0];
  assert.match(event_key, /^[a-f0-9]{64}$/);
  assert.deepEqual(record, {
    event_name: 'purchase_approved',
    order_id: 'order-fixture',
    product_id: product,
    offer_id: 'offer-fixture',
    customer_email: 'buyer+kit@example.test',
    order_status: 'paid',
    created_at_source: '2026-10-25T11:00:00.000Z',
    paid_at: '2026-10-25T11:01:00.000Z',
    refunded_at: null,
    chargedback_at: null,
  });
  for (const sensitive of [secret, 'docNumber', '4242', 'card']) {
    assert.equal(JSON.stringify(batches).includes(sensitive), false);
  }
});

test('supports V2 batches and filters other products without retaining their customers', async () => {
  const { handler, batches } = setup();
  const response = await handler(
    signed(
      envelope([
        order(),
        order({ id: 'order-two' }),
        order({ product: { id: 'other-product' }, customer: { email: 'other@example.test' } }),
      ]),
    ),
  );
  assert.equal(response.status, 200);
  assert.equal(batches.length, 1);
  assert.equal(batches[0].length, 2);
  assert.equal(JSON.stringify(batches).includes('other@example.test'), false);
});

test('deduplicates canonical observations without swallowing later lifecycle events', async () => {
  const { handler, batches } = setup();
  await handler(signed(envelope()));
  await handler(
    signed(envelope(order({ customer: { email: 'buyer+kit@example.test' }, card: null }))),
  );
  await handler(
    signed(envelope(order({ status: 'refunded', refundedAt: '2026-10-25T12:00:00Z' }), 'refund')),
  );
  await handler(signed(envelope(order({ status: 'MED' }), 'chargeback')));
  assert.equal(batches[0][0].event_key, batches[1][0].event_key);
  assert.notEqual(batches[0][0].event_key, batches[2][0].event_key);
  assert.equal(batches[3][0].order_status, 'MED');
});

test('default off and incomplete configuration never reach storage', async () => {
  for (const config of [
    { enabled: false },
    { secret: '' },
    { productIds: [] },
    { productIds: ['bad id'] },
  ]) {
    const { handler, batches } = setup(config);
    assert.equal((await handler(signed(envelope()))).status, 503);
    assert.equal(batches.length, 0);
  }
});

test('rejects unsigned requests even when the body contains the correct secret', async () => {
  const { handler, batches } = setup();
  const req = signed(envelope());
  req.headers.delete('x-cakto-signature');
  assert.equal((await handler(req)).status, 401);
  assert.equal(batches.length, 0);
});

test('rejects tampered raw bytes and invalid signatures', async () => {
  const { handler, batches } = setup();
  const req = signed(envelope());
  const tampered = new Request(req.url, {
    method: 'POST',
    headers: req.headers,
    body: JSON.stringify(envelope()) + ' ',
  });
  assert.equal((await handler(tampered)).status, 401);
  const invalid = signed(envelope());
  invalid.headers.set('x-cakto-signature', 'v1=' + '0'.repeat(64));
  assert.equal((await handler(invalid)).status, 401);
  assert.equal(batches.length, 0);
});

test('rejects stale, future and malformed timestamps', async () => {
  const { handler, batches } = setup();
  for (const timestamp of [
    String(Number(sent) - 301),
    String(Number(sent) + 301),
    'NaN',
    '',
    'Infinity',
  ]) {
    assert.equal((await handler(signed(envelope(), timestamp))).status, 401);
  }
  assert.equal(batches.length, 0);
});

test('verifies raw UTF-8 bytes and tolerates an additional signature version', async () => {
  const { handler, batches } = setup();
  const req = signed({ ...envelope(), description: 'Vértice — equilíbrio' });
  req.headers.set('x-cakto-signature', `v2=unknown, ${req.headers.get('x-cakto-signature')}`);
  assert.equal((await handler(req)).status, 200);
  assert.equal(batches.length, 1);
});

test('rejects malformed JSON and malformed matching orders atomically', async () => {
  const { handler, batches } = setup();
  for (const payload of [
    '{',
    null,
    [],
    {},
    envelope([]),
    envelope(Array.from({ length: 26 }, () => order())),
    envelope([order(), order({ customer: { email: 'invalid' } })]),
    envelope(order({ createdAt: 'yesterday' })),
    envelope(order({ id: 123 })),
    envelope(order({ paidAt: 'not-a-date' })),
    envelope(order({ status: null })),
  ]) {
    assert.equal((await handler(signed(payload))).status, 400);
  }
  assert.equal(batches.length, 0);
});

test('ignores unsupported events and unconfigured products after authenticating', async () => {
  const { handler, batches } = setup();
  for (const payload of [
    envelope({}, 'pix_gerado'),
    envelope({}, 'checkout_abandonment'),
    envelope(order({ product: { id: 'foreign' } })),
  ]) {
    const response = await handler(signed(payload));
    assert.equal(response.status, 200);
    assert.equal((await response.json()).ignored, true);
  }
  assert.equal(batches.length, 0);
});

test('acknowledges only after persistence completes and hides storage errors', async () => {
  let release!: () => void;
  const stored = new Promise<void>((resolve) => {
    release = resolve;
  });
  const { handler } = setup({ capture: () => stored });
  let acknowledged = false;
  const response = handler(signed(envelope())).then((value) => {
    acknowledged = true;
    return value;
  });
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(acknowledged, false);
  release();
  assert.equal((await response).status, 200);
  const failing = setup({
    capture: async () => {
      throw new Error('private-db-error buyer@example.test');
    },
  });
  const failed = await failing.handler(signed(envelope()));
  assert.equal(failed.status, 503);
  assert.equal((await failed.text()).includes('buyer@example.test'), false);
});

test('caps both declared and streamed body size before parsing', async () => {
  const { handler, batches } = setup();
  const declared = signed(envelope());
  declared.headers.set('content-length', String(128 * 1024 + 1));
  assert.equal((await handler(declared)).status, 413);
  const streamed = signed(' '.repeat(128 * 1024 + 1));
  assert.equal(streamed.headers.get('content-length'), null);
  assert.equal((await handler(streamed)).status, 413);
  assert.equal(batches.length, 0);
});

test('accepts POST JSON only', async () => {
  const { handler, batches } = setup();
  for (const method of ['GET', 'OPTIONS', 'PUT']) {
    const response = await handler(new Request('https://example.test', { method }));
    assert.equal(response.status, 405);
    assert.equal(response.headers.get('allow'), 'POST');
  }
  const req = signed(envelope());
  req.headers.set('content-type', 'text/plain');
  assert.equal((await handler(req)).status, 415);
  assert.equal(batches.length, 0);
});
