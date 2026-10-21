import { decodeJwt, importJWK, jwtVerify, type JWK } from 'jose';
export const OFFLINE_SECONDS = 7 * 24 * 60 * 60;
export interface Account {
  uid: string;
  email: string;
}
export interface VerifiedLease {
  uid: string;
  email: string;
  expiresAt: number;
  issuedAt: number;
  licenseId: string;
  version: number;
}
export async function verifyLease(
  token: string,
  account: Account,
  config: { publicKey: JWK; issuer: string; audience: string },
  now = Date.now(),
  allowExpired = false,
): Promise<VerifiedLease> {
  const key = await importJWK(config.publicKey, 'ES256');
  const { payload, protectedHeader } = await jwtVerify(token, key, {
    algorithms: ['ES256'],
    issuer: config.issuer,
    audience: config.audience,
    subject: account.uid,
    currentDate: new Date(
      allowExpired ? Math.min(now, Number(decodeJwt(token).exp) * 1000 - 1) : now,
    ),
    requiredClaims: ['iat', 'exp', 'sub', 'iss', 'aud'],
  });
  if (
    protectedHeader.typ !== 'JWT' ||
    protectedHeader.kid !== 'vertice-access-v1' ||
    !payload.iat ||
    !payload.exp ||
    payload.exp <= payload.iat ||
    payload.exp - payload.iat > OFFLINE_SECONDS ||
    payload.iat * 1000 > now + 60000 ||
    typeof payload.email !== 'string' ||
    typeof payload.licenseId !== 'string' ||
    !Number.isSafeInteger(payload.version) ||
    Number(payload.version) < 1
  )
    throw new Error('Autorização inválida.');
  return {
    uid: account.uid,
    email: payload.email,
    expiresAt: payload.exp * 1000,
    issuedAt: payload.iat * 1000,
    licenseId: payload.licenseId,
    version: Number(payload.version),
  };
}
export function usableUntil(
  expiresAt: number,
  wall: number,
  highWater: number,
  monotonicFloor: number,
): boolean {
  return wall + 60000 >= highWater && Math.max(wall, highWater, monotonicFloor) < expiresAt;
}
