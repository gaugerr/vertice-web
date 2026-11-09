import { importJWK, jwtVerify } from 'jose';
export async function verifyWorkspaceLease(
  token,
  {
    uid,
    workspaceId,
    generation,
    workspaceKind = 'shared',
    publicKey,
    issuer,
    audience,
    now = Date.now(),
  },
) {
  const key = await importJWK(publicKey, 'ES256');
  const { payload, protectedHeader } = await jwtVerify(token, key, {
    algorithms: ['ES256'],
    issuer,
    audience,
    subject: uid,
    currentDate: new Date(now),
    requiredClaims: ['sub', 'exp', 'iat', 'iss', 'aud'],
  });
  if (
    protectedHeader.kid !== 'vertice-workspace-v1' ||
    protectedHeader.typ !== 'JWT' ||
    payload.workspaceId !== workspaceId ||
    payload.generation !== generation ||
    typeof payload.writable !== 'boolean' ||
    !payload.iat ||
    !payload.exp ||
    payload.kind !== workspaceKind ||
    payload.exp - payload.iat > (workspaceKind === 'shared' ? 86400 : 604800) ||
    payload.exp <= payload.iat ||
    payload.iat * 1000 > now + 60000
  )
    throw Error('Autorização do espaço inválida.');
  return {
    member: true,
    uid,
    workspace_id: workspaceId,
    generation,
    writable: payload.writable,
    expiresAt: payload.exp * 1000,
  };
}
