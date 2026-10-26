import { HttpError, serve, service } from '../_shared/http.ts';

Deno.serve((req) =>
  serve(req, async (userId) => {
    if (Number(req.headers.get('content-length') ?? 0) > 4096)
      throw new HttpError(413, 'Request too large');
    const text = await req.text();
    if (text.length > 4096) throw new HttpError(413, 'Request too large');
    let input: unknown;
    try {
      input = JSON.parse(text);
    } catch {
      throw new HttpError(400, 'Invalid JSON');
    }
    if (!input || typeof input !== 'object' || Array.isArray(input))
      throw new HttpError(400, 'Invalid request');
    const operation = (input as Record<string, unknown>).action;
    const { data, error } = await service.rpc(
      operation === 'delete' ? 'access_admin_delete_license' : 'access_admin',
      { actor: userId, input },
    );
    if (error)
      throw new HttpError(
        error.code === '42501' || error.code === '28000' ? 403 : 400,
        error.code === '42501'
          ? 'Administrator required'
          : operation === 'delete'
            ? 'Deletion failed; no records were removed'
            : 'Check the request; email may already be licensed',
      );
    return data;
  }),
);
