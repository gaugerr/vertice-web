import { readFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';
import { importJWK, jwtVerify } from 'jose';

export const appOrigin = 'http://127.0.0.1:4173';
const localApi = 'http://127.0.0.1:54321';
type UserKind = 'owner' | 'buyer' | 'other' | 'unknown';
interface LocalFixture {
  url: string;
  key: string;
  users: Record<UserKind, { uid: string; email: string; password: string }>;
}

export class LocalAccessError extends Error {
  status: number | undefined;
  constructor(message: string, status?: number) {
    super(message);
    this.status = status;
  }
}

export async function readLocalFixture(): Promise<LocalFixture> {
  const fixture = JSON.parse(
    await readFile(new URL('../../.secrets/fixtures.json', import.meta.url), 'utf8'),
  ) as LocalFixture;
  if (fixture.url !== localApi || !fixture.key) {
    throw new LocalAccessError('Access fixtures must use the isolated local Supabase.');
  }
  return fixture;
}

export async function signInTestUser(kind: UserKind = 'buyer') {
  const fixture = await readLocalFixture();
  const user = fixture.users[kind];
  if (!user?.password || !user.email.endsWith('@example.test')) {
    throw new LocalAccessError(`Missing isolated credentials for ${kind}.`);
  }
  const client = createClient(fixture.url, fixture.key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = await client.auth.signInWithPassword({
    email: user.email,
    password: user.password,
  });
  if (error || !data.session || data.user?.id !== user.uid) {
    throw new LocalAccessError(
      `Isolated sign-in failed for ${kind} (HTTP ${error?.status ?? 'invalid response'}).`,
      error?.status,
    );
  }
  return { fixture, client, session: data.session };
}

export type TestSession = Awaited<ReturnType<typeof signInTestUser>>;

export async function checkTestLicense(auth: TestSession) {
  if (auth.fixture.url !== localApi) {
    throw new LocalAccessError('License checks must use the isolated local Supabase.');
  }
  return fetch(`${auth.fixture.url}/functions/v1/license-check`, {
    method: 'POST',
    signal: AbortSignal.timeout(10000),
    headers: {
      Origin: appOrigin,
      Authorization: `Bearer ${auth.session.access_token}`,
      apikey: auth.fixture.key,
      'Content-Type': 'application/json',
    },
    body: '{}',
  });
}

export async function signedBrowserState(auth: TestSession) {
  const response = await checkTestLicense(auth);
  if (!response.ok) {
    throw new LocalAccessError(
      `Fresh test session rejected by license-check (HTTP ${response.status}).`,
      response.status,
    );
  }
  const result = (await response.json()) as {
    status: string;
    lease?: string;
    serverTime?: number;
  };
  if (
    result.status !== 'active' ||
    !result.lease ||
    !Number.isFinite(result.serverTime) ||
    Math.abs(Date.now() - result.serverTime! * 1000) > 60000
  ) {
    throw new LocalAccessError('Fresh test session did not receive an active, current license.');
  }
  const publicKey = JSON.parse(
    await readFile(new URL('../../src/access/license-public-key.json', import.meta.url), 'utf8'),
  );
  try {
    await jwtVerify(result.lease, await importJWK(publicKey, 'ES256'), {
      algorithms: ['ES256'],
      issuer: auth.fixture.url,
      audience: appOrigin,
      subject: auth.session.user.id,
      requiredClaims: ['iat', 'exp', 'sub', 'iss', 'aud'],
    });
  } catch {
    throw new LocalAccessError('Test authorization does not match the local signing key/account.');
  }
  const account = { uid: auth.session.user.id, email: auth.session.user.email ?? '' };
  return {
    cookies: [],
    origins: [
      {
        origin: appOrigin,
        localStorage: [
          { name: 'sb-127-auth-token', value: JSON.stringify(auth.session) },
          {
            name: `vertice:access:${auth.fixture.url}:lease`,
            value: JSON.stringify({ account, token: result.lease, highWater: Date.now() }),
          },
        ],
      },
    ],
  };
}

export async function closeTestSession(auth: TestSession) {
  const { error } = await auth.client.auth.signOut({ scope: 'local' });
  // A browser logout may have already removed this exact session.
  if (error && error.name !== 'AuthSessionMissingError' && error.code !== 'session_not_found') {
    throw new LocalAccessError(
      `Could not close the isolated test session (${error.status ?? 'network'}, ${error.code ?? 'unknown'}).`,
      error.status,
    );
  }
}
