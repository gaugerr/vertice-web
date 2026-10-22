import { readFile, writeFile } from 'node:fs/promises';
const fixture = JSON.parse(await readFile('.secrets/fixtures.json', 'utf8'));
const origin = 'http://127.0.0.1:4173';
let lease;
for (let attempt = 0; attempt < 30; attempt++) {
  try {
    const response = await fetch(`${fixture.url}/functions/v1/license-check`, {
      method: 'POST',
      headers: {
        Origin: origin,
        Authorization: `Bearer ${fixture.users.buyer.session.access_token}`,
        apikey: fixture.key,
        'Content-Type': 'application/json',
      },
      body: '{}',
    });
    if (response.ok) {
      lease = await response.json();
      if (lease.status === 'active' && lease.lease) break;
    }
  } catch {
    /* local edge runtime starting */
  }
  await new Promise((resolve) => setTimeout(resolve, 1000));
}
if (!lease?.lease) throw new Error('Local license-check did not become ready');
const account = { uid: fixture.users.buyer.uid, email: fixture.users.buyer.email };
const localStorage = [
  { name: 'sb-127-auth-token', value: JSON.stringify(fixture.users.buyer.session) },
  {
    name: `vertice:access:${fixture.url}:lease`,
    value: JSON.stringify({ account, token: lease.lease, highWater: Date.now() }),
  },
];
await writeFile(
  '.secrets/browser-state.json',
  JSON.stringify({ cookies: [], origins: [{ origin, localStorage }] }),
);
console.log('Local signed browser authorization prepared.');
