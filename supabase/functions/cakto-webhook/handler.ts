// Verify and durably capture events before delegating optional license processing.
const MAX_BYTES = 128 * 1024;
const MAX_ORDERS = 25;
const EVENTS = new Set(['purchase_approved', 'refund', 'chargeback']);
const ID = /^[A-Za-z0-9_.-]{1,120}$/;

export interface CapturedEvent {
  event_key: string;
  event_name: string;
  order_id: string;
  product_id: string;
  offer_id: string | null;
  customer_email: string;
  order_status: string;
  created_at_source: string;
  paid_at: string | null;
  refunded_at: string | null;
  chargedback_at: string | null;
}

interface Dependencies {
  enabled: boolean;
  secret: string;
  productIds: string[];
  capture: (events: CapturedEvent[]) => Promise<void>;
  process?: () => Promise<void>;
  now?: () => number;
}

class RequestError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function reply(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      ...(status === 405 ? { Allow: 'POST' } : {}),
    },
  });
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new RequestError(400, 'Invalid event');
  }
  return value as Record<string, unknown>;
}

function identifier(value: unknown): string {
  if (typeof value !== 'string' || !ID.test(value)) {
    throw new RequestError(400, 'Invalid identifier');
  }
  return value;
}

function timestamp(value: unknown, required = false): string | null {
  if (value == null && !required) return null;
  if (
    typeof value !== 'string' ||
    value.length > 40 ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/.test(value) ||
    !Number.isFinite(Date.parse(value))
  ) {
    throw new RequestError(400, 'Invalid timestamp');
  }
  return new Date(value).toISOString();
}

async function readBody(req: Request): Promise<Uint8Array<ArrayBuffer>> {
  const length = Number(req.headers.get('content-length'));
  if (length > MAX_BYTES) throw new RequestError(413, 'Request too large');
  const reader = req.body?.getReader();
  if (!reader) throw new RequestError(400, 'Missing event');
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BYTES) {
        await reader.cancel();
        throw new RequestError(413, 'Request too large');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

async function verify(req: Request, secret: string, now: number) {
  const sent = req.headers.get('x-cakto-timestamp') ?? '';
  const signature = (req.headers.get('x-cakto-signature') ?? '')
    .split(',')
    .map((part) => part.trim())
    .find((part) => /^v1=[a-fA-F0-9]{64}$/.test(part));
  if (
    !/^\d{10,11}$/.test(sent) ||
    Math.abs(Math.floor(now / 1000) - Number(sent)) > 300 ||
    !signature
  ) {
    throw new RequestError(401, 'Invalid signature');
  }
  const body = await readBody(req);
  const prefix = new TextEncoder().encode(`${sent}.`);
  const signed = new Uint8Array(prefix.length + body.length);
  signed.set(prefix);
  signed.set(body, prefix.length);
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  );
  const digest = Uint8Array.from(signature.slice(3).match(/../g)!, (byte) => parseInt(byte, 16));
  if (!(await crypto.subtle.verify('HMAC', key, digest, signed))) {
    throw new RequestError(401, 'Invalid signature');
  }
  try {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(body)) as unknown;
  } catch {
    throw new RequestError(400, 'Invalid JSON');
  }
}

async function normalize(payload: unknown, productIds: string[]): Promise<CapturedEvent[]> {
  const envelope = object(payload);
  if (typeof envelope.event !== 'string') throw new RequestError(400, 'Missing event');
  if (!EVENTS.has(envelope.event)) return [];
  const orders = Array.isArray(envelope.data) ? envelope.data : [envelope.data];
  if (!orders.length || orders.length > MAX_ORDERS) {
    throw new RequestError(400, 'Invalid batch size');
  }
  const records: CapturedEvent[] = [];
  for (const value of orders) {
    const order = object(value);
    const productId = identifier(object(order.product).id);
    if (!productIds.includes(productId)) continue;
    const email = object(order.customer).email;
    if (
      typeof email !== 'string' ||
      email.trim().length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
    ) {
      throw new RequestError(400, 'Invalid customer email');
    }
    if (typeof order.status !== 'string' || !/^[A-Za-z_]{1,40}$/.test(order.status)) {
      throw new RequestError(400, 'Invalid order status');
    }
    // Only this allowlist is persisted. Never persist the envelope, secret, CPF or card data.
    const record = {
      event_name: envelope.event,
      order_id: identifier(order.id),
      product_id: productId,
      offer_id: order.offer == null ? null : identifier(object(order.offer).id),
      customer_email: email.trim().toLowerCase(),
      order_status: order.status,
      created_at_source: timestamp(order.createdAt, true)!,
      paid_at: timestamp(order.paidAt),
      refunded_at: timestamp(order.refundedAt),
      chargedback_at: timestamp(order.chargedbackAt),
    };
    const digest = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(JSON.stringify(record)),
    );
    const eventKey = Array.from(new Uint8Array(digest), (byte) =>
      byte.toString(16).padStart(2, '0'),
    ).join('');
    records.push({ event_key: eventKey, ...record });
  }
  return records;
}

export function createCaktoHandler(deps: Dependencies) {
  return async (req: Request): Promise<Response> => {
    if (req.method !== 'POST') return reply(405, { error: 'POST required' });
    if (
      !deps.enabled ||
      deps.secret.length < 16 ||
      !deps.productIds.length ||
      deps.productIds.some((id) => !ID.test(id))
    ) {
      return reply(503, { error: 'Capture not configured' });
    }
    if (
      req.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json'
    ) {
      return reply(415, { error: 'JSON required' });
    }
    try {
      const payload = await verify(req, deps.secret, (deps.now ?? Date.now)());
      const records = await normalize(payload, deps.productIds);
      // Acknowledge only after the whole batch has been durably stored.
      if (records.length) await deps.capture(records);
      if (records.length && deps.process) {
        try {
          await deps.process();
          return reply(200, { received: true, mode: 'process', processing: 'attempted' });
        } catch {
          // Storage already succeeded. A retry job can recover the durable pending events.
          return reply(200, { received: true, mode: 'process', processing: 'pending' });
        }
      }
      return reply(200, { received: true, mode: 'capture', ignored: records.length === 0 });
    } catch (error) {
      // Do not log payloads or return database errors (they may contain personal data).
      return error instanceof RequestError
        ? reply(error.status, { error: error.message })
        : reply(503, { error: 'Capture temporarily unavailable' });
    }
  };
}
