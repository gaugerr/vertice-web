import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
export function postgresFixture(container) {
  const name = 'test_' + crypto.randomUUID().replaceAll('-', '');
  const docker = (args, input) =>
    execFileSync(
      'docker',
      ['--host=unix:///var/run/docker.sock', 'exec', '-i', container, ...args],
      { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
    ).trim();
  docker(['createdb', '-U', 'postgres', name]);
  const literal = (v) =>
    v === null
      ? 'null'
      : "'" + String(typeof v === 'object' ? JSON.stringify(v) : v).replaceAll("'", "''") + "'";
  const sql = (text, role = 'postgres') => {
    try {
      return docker(
        [
          'psql',
          '-X',
          '-q',
          '-t',
          '-A',
          '-v',
          'ON_ERROR_STOP=1',
          '-v',
          'VERBOSITY=verbose',
          '-U',
          'postgres',
          '-d',
          name,
        ],
        `set role ${role};\n` + text,
      );
    } catch (e) {
      const message = e.stderr?.toString() ?? String(e);
      const error = new Error(message);
      error.code = message.match(/ERROR:\s+([A-Z0-9]{5}):/)?.[1];
      throw error;
    }
  };
  sql(`do $$begin if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin;end if;if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin;end if;if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls;end if;end $$;
 create schema auth;create table auth.users(id uuid primary key,email_confirmed_at timestamptz);create table auth.identities(user_id uuid references auth.users,provider text,identity_data jsonb);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to anon,authenticated,service_role;grant select on auth.users,auth.identities to service_role;
 create table public.licenses(user_id uuid unique references auth.users,status text);alter table public.licenses enable row level security;revoke all on public.licenses from public,anon,authenticated;grant select on public.licenses to authenticated;grant all on public.licenses to service_role;create policy own_license on public.licenses for select to authenticated using(user_id=(select auth.uid()));
 insert into auth.users values('11111111-1111-4111-8111-111111111111',now()),('22222222-2222-4222-8222-222222222222',now());
 insert into auth.identities values('11111111-1111-4111-8111-111111111111','google','{"email":"titular@exemplo.test","email_verified":true}'),('22222222-2222-4222-8222-222222222222','google','{"email":"parceiro@exemplo.test","email_verified":true}');
 insert into public.licenses values('11111111-1111-4111-8111-111111111111','active');`);
  sql(
    readFileSync(
      new URL('../../supabase/drafts/shared-spaces/schema.sql', import.meta.url),
      'utf8',
    ),
  );
  return {
    command: async (actor, action, input) =>
      JSON.parse(
        sql(
          `select public.workspace_command(${literal(actor)}::uuid,${literal(action)},${literal(input)}::jsonb);`,
          'service_role',
        ),
      ),
    close: () => docker(['dropdb', '-U', 'postgres', name]),
  };
}
