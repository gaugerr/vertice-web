-- Run only AFTER Gustavo has signed in with his verified Google account.
-- This is deliberately explicit and never promotes the first person to sign in.
begin;
do $$
declare owner_uid uuid;
begin
  select i.user_id into strict owner_uid from auth.identities i join auth.users u on u.id = i.user_id
    where i.provider = 'google' and lower(btrim(i.identity_data->>'email')) = 'gustavojosiasg@gmail.com'
    and i.identity_data->>'email_verified' = 'true' and u.email_confirmed_at is not null;
  insert into access_private.admins(user_id) values(owner_uid) on conflict do nothing;
  insert into public.licenses(email, user_id) values('gustavojosiasg@gmail.com', owner_uid)
    on conflict(email) do nothing;
end $$;
commit;
