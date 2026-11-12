-- Keep only auth-related public tables used by the live app:
-- profiles, user_roles, user_preferences, app_bootstrap.
-- Jobs/money live in the VPS file store, not Postgres.

create or replace function public.bootstrap_admin()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_email text;
begin
  if exists (select 1 from app_bootstrap) then
    return;
  end if;
  select email into caller_email from auth.users where id = auth.uid();
  if lower(caller_email) is distinct from 'nagarn603@gmail.com' then
    return;
  end if;
  insert into user_roles (user_id, role) values (auth.uid(), 'admin') on conflict do nothing;
  insert into user_roles (user_id, role) values (auth.uid(), 'finance') on conflict do nothing;
  insert into app_bootstrap (id, user_id) values (1, auth.uid());
end;
$$;

drop table if exists public.jobs_archive cascade;
drop table if exists public.jobs_current cascade;
drop table if exists public.saved_jobs cascade;
drop table if exists public.application_events cascade;
drop table if exists public.entitlements cascade;
drop table if exists public.commission_ledger cascade;
drop table if exists public.purchase_orders cascade;
drop table if exists public.plans cascade;
drop table if exists public.sources cascade;
drop table if exists public.companies cascade;
drop table if exists public.job_identity cascade;
drop table if exists public.audit_events cascade;
