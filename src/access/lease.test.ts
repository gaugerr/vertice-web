// @vitest-environment node
import { beforeAll, describe, expect, it } from 'vitest';
import { exportJWK, generateKeyPair, SignJWT, type JWK } from 'jose';
import { OFFLINE_SECONDS, usableUntil, verifyLease } from './lease';
let privateKey: CryptoKey;
let publicKey: JWK;
const account = { uid: '83ec6841-7434-4dde-bd1d-490d35519d87', email: 'buyer@example.com' };
const now = Date.now();
const seconds = Math.floor(now / 1000);
const issuer = 'https://project.supabase.co';
const audience = 'https://app.example.com';
beforeAll(async () => {
  const keys = await generateKeyPair('ES256', { extractable: true });
  privateKey = keys.privateKey;
  publicKey = await exportJWK(keys.publicKey);
});
async function sign(expires = seconds + OFFLINE_SECONDS, uid = account.uid, aud = audience) {
  return new SignJWT({ licenseId: crypto.randomUUID(), version: 1, email: account.email })
    .setProtectedHeader({ alg: 'ES256', typ: 'JWT', kid: 'vertice-access-v1' })
    .setSubject(uid)
    .setIssuer(issuer)
    .setAudience(aud)
    .setIssuedAt(seconds)
    .setExpirationTime(expires)
    .sign(privateKey);
}
describe('signed offline lease', () => {
  it('allows exactly the licensed identity and origin for at most seven days', async () => {
    const token = await sign();
    const lease = await verifyLease(token, account, { publicKey, issuer, audience }, now);
    expect(lease.uid).toBe(account.uid);
    expect(lease.expiresAt - lease.issuedAt).toBe(604800000);
    await expect(
      verifyLease(
        token,
        { ...account, uid: crypto.randomUUID() },
        { publicKey, issuer, audience },
        now,
      ),
    ).rejects.toThrow();
    await expect(
      verifyLease(
        token,
        account,
        { publicKey, issuer, audience: 'https://other.example.com' },
        now,
      ),
    ).rejects.toThrow();
  });
  it('rejects unsigned changes, another key, oversized duration and a future issuance', async () => {
    const token = await sign();
    const parts = token.split('.');
    parts[1] = Buffer.from(
      JSON.stringify({ sub: account.uid, exp: seconds + OFFLINE_SECONDS }),
    ).toString('base64url');
    await expect(
      verifyLease(parts.join('.'), account, { publicKey, issuer, audience }, now),
    ).rejects.toThrow();
    const other = await generateKeyPair('ES256', { extractable: true });
    await expect(
      verifyLease(
        token,
        account,
        { publicKey: await exportJWK(other.publicKey), issuer, audience },
        now,
      ),
    ).rejects.toThrow();
    await expect(
      verifyLease(
        await sign(seconds + OFFLINE_SECONDS + 1),
        account,
        { publicKey, issuer, audience },
        now,
      ),
    ).rejects.toThrow();
    await expect(
      verifyLease(token, account, { publicKey, issuer, audience }, now - 120000),
    ).rejects.toThrow();
  });
  it('does not extend an expired lease on restart but verifies its identity for committed-data export', async () => {
    const token = await sign();
    const later = now + 8 * 86400000;
    await expect(
      verifyLease(token, account, { publicKey, issuer, audience }, later),
    ).rejects.toThrow();
    const expired = await verifyLease(token, account, { publicKey, issuer, audience }, later, true);
    expect(usableUntil(expired.expiresAt, later, later, later)).toBe(false);
  });
  it('detects rollback and expires even if a running clock is moved back', () => {
    expect(usableUntil(1000000, 500000, 800000, 800000)).toBe(false);
    expect(usableUntil(1000000, 990000, 990000, 1000001)).toBe(false);
    expect(usableUntil(1000000, 999999, 999999, 999999)).toBe(true);
    expect(usableUntil(1000000, 1000000, 1000000, 1000000)).toBe(false);
  });
});
