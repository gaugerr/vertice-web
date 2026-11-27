export interface WorkspaceDependencies {
  enabled: boolean;
  allowedOrigins: string[];
  authenticate: (token: string) => Promise<{ uid: string } | null>;
  command: (actor: string, action: string, input: Record<string, unknown>) => Promise<unknown>;
  sign: (actor: string, origin: string, access: Record<string, unknown>) => Promise<string>;
  randomToken: () => string;
  hash: (raw: string) => Promise<string>;
}
const actions = new Set([
  'list',
  'create',
  'invite',
  'inspect_invite',
  'accept',
  'members',
  'remove',
  'leave',
  'close',
  'revoke_invite',
  'access',
  'pull',
  'apply',
  'copy',
]);
const codes: Record<string, [number, string]> = {
  client_update_required: [
    409,
    'Atualize a página para continuar com os novos recursos financeiros. Seus dados foram preservados.',
  ],
  removed: [403, 'Você não participa mais deste espaço.'],
  forbidden: [403, 'Este espaço está disponível somente para consulta.'],
  generation: [403, 'Sua participação mudou. Reabra o espaço.'],
  wrong_account: [403, 'Entre com a conta Google convidada.'],
  invalid_invite: [410, 'Este convite expirou ou foi cancelado.'],
  full: [409, 'O espaço já tem duas pessoas.'],
  already_shared: [409, 'Você já participa de um espaço compartilhado.'],
  not_empty: [409, 'O espaço já tem dados. A cópia não substitui registros.'],
  conflict: [409, 'Outra pessoa alterou este registro. Revise antes de salvar.'],
};
export async function workspaceHandler(
  req: Request,
  deps: WorkspaceDependencies,
): Promise<Response> {
  const origin = req.headers.get('origin') ?? '';
  const headers = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    'Referrer-Policy': 'no-referrer',
    Vary: 'Origin',
    ...(deps.allowedOrigins.includes(origin) ? { 'Access-Control-Allow-Origin': origin } : {}),
    'Access-Control-Allow-Headers': 'authorization,content-type,apikey,x-client-info',
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
  };
  const reply = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers });
  if (!deps.enabled) return reply(404, { error: 'Recurso ainda não ativado.' });
  if (!deps.allowedOrigins.includes(origin)) return reply(403, { error: 'Origem não permitida.' });
  if (req.method === 'OPTIONS') return reply(200, { ok: true });
  if (req.method !== 'POST') return reply(405, { error: 'Use POST.' });
  try {
    if (Number(req.headers.get('content-length') ?? 0) > 6 * 1024 * 1024)
      return reply(413, { error: 'Operação muito grande.' });
    const token = req.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1];
    if (!token) return reply(401, { code: 'unauthorized', error: 'Entre com sua conta Google.' });
    const actor = await deps.authenticate(token);
    if (!actor)
      return reply(401, {
        code: 'unauthorized',
        error: 'Entre novamente com uma conta Google verificada.',
      });
    const raw = await req.text();
    if (new TextEncoder().encode(raw).length > 6 * 1024 * 1024)
      return reply(413, { error: 'Operação muito grande.' });
    let body;
    try {
      body = JSON.parse(raw);
    } catch {
      return reply(400, { error: 'Solicitação inválida.' });
    }
    const action = body.action;
    if (
      !actions.has(action) ||
      !body.input ||
      typeof body.input !== 'object' ||
      Array.isArray(body.input)
    )
      return reply(400, { error: 'Solicitação inválida.' });
    const input = { ...body.input };
    delete input.actor;
    delete input.user_id_claim;
    let inviteToken: string | undefined;
    if (action === 'invite') {
      const email = String(input.email ?? '')
        .trim()
        .toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254)
        return reply(400, { error: 'Informe o e-mail Google da outra pessoa.' });
      input.email = email;
      inviteToken = deps.randomToken();
      input.token_hash = await deps.hash(inviteToken);
    }
    if (action === 'accept' || action === 'inspect_invite') {
      if (typeof input.token !== 'string' || !/^[a-f0-9]{64}$/.test(input.token))
        return reply(410, { code: 'invalid_invite', error: 'Convite inválido.' });
      input.token_hash = await deps.hash(input.token);
      delete input.token;
    }
    const result = await deps.command(actor.uid, action, input);
    if (action === 'access') {
      const access = result as Record<string, unknown>;
      return reply(200, {
        generation: access.generation,
        kind: access.kind,
        lease: await deps.sign(actor.uid, origin, access),
      });
    }
    return reply(200, inviteToken ? { ...(result as object), token: inviteToken } : result);
  } catch (e) {
    const error = e as { message?: string; code?: string };
    const code =
      Object.keys(codes).find((c) => error.message === c) ??
      (error.code === '40001' ? 'conflict' : undefined);
    if (code) {
      const [status, message] = codes[code];
      return reply(status, { code, error: message });
    }
    if (['23514', '23503', '23505', '22P02', '22003'].includes(error.code ?? ''))
      return reply(422, {
        code: 'validation',
        error: 'Os dados não puderam ser salvos. Revise os valores e vínculos.',
      });
    return reply(503, {
      code: 'network',
      error:
        'Não foi possível verificar ou sincronizar o espaço. Seus dados locais foram preservados.',
    });
  }
}
