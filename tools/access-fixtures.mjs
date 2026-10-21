// Local integration fixture only. Never run against a hosted project.
import { createClient } from '@supabase/supabase-js';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile, appendFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const status = JSON.parse(await readFile('/tmp/vertice-supabase-status.json', 'utf8'));
const url = status.API_URL;
assert.equal(url, 'http://127.0.0.1:54321');
const admin = createClient(url, status.SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const users = {};
for (const kind of ['owner', 'buyer', 'other', 'unknown']) {
  const email = `${kind}@example.test`;
  const password = crypto.randomUUID();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw error;
  const uid = data.user.id;
  const sql = `insert into auth.identities(provider_id,user_id,identity_data,provider) values ('${uid}','${uid}','${JSON.stringify({ email, email_verified: true, sub: uid })}','google');`;
  execFileSync(
    'docker',
    [
      'exec',
      '-i',
      'supabase_db_vertice_access_test',
      'psql',
      '-U',
      'postgres',
      '-d',
      'postgres',
      '-v',
      'ON_ERROR_STOP=1',
    ],
    { input: sql, stdio: ['pipe', 'ignore', 'pipe'] },
  );
  const client = createClient(url, status.ANON_KEY, { auth: { persistSession: false } });
  const login = await client.auth.signInWithPassword({ email, password });
  if (login.error) throw login.error;
  users[kind] = { uid, email, session: login.data.session };
}
execFileSync(
  'docker',
  [
    'exec',
    '-i',
    'supabase_db_vertice_access_test',
    'psql',
    '-U',
    'postgres',
    '-d',
    'postgres',
    '-v',
    'ON_ERROR_STOP=1',
  ],
  {
    input: `insert into access_private.admins(user_id) values ('${users.owner.uid}'); insert into public.licenses(email,user_id) values ('${users.owner.email}','${users.owner.uid}'),('${users.buyer.email}','${users.buyer.uid}');`,
    stdio: ['pipe', 'ignore', 'pipe'],
  },
);
await writeFile('.secrets/fixtures.json', JSON.stringify({ url, key: status.ANON_KEY, users }));
await writeFile(
  '.env.local',
  `VITE_ACCESS_MODE=enforced\nVITE_SUPABASE_URL=${url}\nVITE_SUPABASE_PUBLISHABLE_KEY=${status.ANON_KEY}\n`,
);
await appendFile(
  '.secrets/license.env',
  `ACCESS_ALLOWED_ORIGINS=http://127.0.0.1:4173\nACCESS_ISSUER=${url}\n`,
);
console.log('Created isolated local identities and licenses. No hosted credentials used.');
