-- Pikajobs initial schema. Apply to the single Supabase Postgres project.
-- jobs_current and jobs_archive live in the same database. Clients do not get table access.

create extension if not exists pgcrypto;

create table if not exists profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  country_code text not null default 'IN',
  current_stage text not null default '',
  onboarding_step integer not null default 0,
  onboarding_completed boolean not null default false,
  adult_confirmed boolean not null default false,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists user_roles (
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('admin', 'reviewer', 'finance')),
  primary key (user_id, role)
);

create table if not exists user_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  opportunity_kinds text[] not null default '{}',
  sectors text[] not null default '{}',
  role_family_slugs text[] not null default '{}',
  skill_slugs text[] not null default '{}',
  work_modes text[] not null default '{}',
  location_label text not null default '',
  country_code text not null default 'IN',
  experience_band text not null default '',
  stage text not null default '',
  show_unknown_pay boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null,
  canonical_domain text not null,
  permission_basis text not null default '',
  enabled boolean not null default false,
  board_id text not null default '',
  last_success_at timestamptz
);

create table if not exists companies (
  id uuid primary key default gen_random_uuid(),
  normalized_name text not null unique,
  display_name text not null
);

create table if not exists job_identity (
  id uuid primary key default gen_random_uuid(),
  fingerprint text not null unique,
  company_id uuid references companies (id),
  effective_job_at timestamptz not null,
  first_seen_at timestamptz not null,
  lifecycle text not null check (lifecycle in ('draft', 'in_review', 'published', 'archived', 'removed', 'closed'))
);

create table if not exists jobs_current (
  job_id uuid primary key references job_identity (id),
  version integer not null check (version > 0),
  title text not null,
  company_name text not null,
  summary text not null,
  opportunity_kind text not null,
  sector text not null,
  work_mode text not null,
  role_family_slug text,
  location_label text not null,
  location_unknown boolean not null default false,
  country_code text,
  eligible_countries text[] not null default '{}',
  skills text[] not null default '{}',
  requirements text[] not null default '{}',
  compensation_type text not null,
  pay_min_minor bigint,
  pay_max_minor bigint,
  pay_currency text,
  pay_period text,
  pay_basis text,
  application_method text not null check (application_method in ('url', 'email', 'both')),
  application_url text,
  hr_email text,
  email_subject text,
  hr_email_approved boolean not null default false,
  source_id uuid not null references sources (id),
  source_url text not null,
  external_job_id text,
  source_published_at timestamptz,
  first_seen_at timestamptz not null,
  effective_job_at timestamptz not null,
  visible_until timestamptz not null,
  published_at timestamptz,
  last_checked_at timestamptz,
  deadline_at timestamptz,
  access_tier text not null check (access_tier in ('free', 'pro')),
  verification text not null default 'unreviewed',
  lifecycle text not null,
  government jsonb,
  evidence jsonb not null default '[]'::jsonb,
  search_vector tsvector generated always as (
    to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(company_name, '') || ' ' || coalesce(summary, ''))
  ) stored,
  check (pay_min_minor is null or pay_min_minor >= 0),
  check (pay_max_minor is null or pay_min_minor is null or pay_min_minor <= pay_max_minor)
);

create table if not exists jobs_archive (
  like jobs_current including defaults including generated including constraints,
  archive_reason text not null,
  archived_at timestamptz not null default now(),
  primary key (job_id)
);

create index if not exists jobs_current_feed_idx on jobs_current (effective_job_at desc, job_id desc);
create index if not exists jobs_current_visible_idx on jobs_current (visible_until);
create index if not exists jobs_current_search_idx on jobs_current using gin (search_vector);

create table if not exists saved_jobs (
  user_id uuid not null references auth.users (id) on delete cascade,
  job_id uuid not null references job_identity (id),
  created_at timestamptz not null default now(),
  primary key (user_id, job_id)
);

create table if not exists application_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  job_id uuid not null references job_identity (id),
  event_kind text not null check (event_kind in ('opened', 'applied')),
  occurred_at timestamptz not null default now()
);

create table if not exists plans (
  id text primary key,
  price_minor bigint not null check (price_minor >= 0),
  currency text not null,
  access_days integer not null check (access_days > 0),
  commissionable boolean not null default true,
  active boolean not null default true
);

insert into plans (id, price_minor, currency, access_days, commissionable)
values ('pro-pass-30', 19900, 'INR', 30, true)
on conflict (id) do nothing;

create table if not exists purchase_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id),
  plan_id text not null references plans (id),
  product_minor bigint not null check (product_minor >= 0),
  tax_minor bigint not null default 0 check (tax_minor >= 0),
  currency text not null,
  days integer not null,
  commissionable boolean not null,
  rate_bps integer not null,
  referrer_user_id uuid references auth.users (id),
  provider_order_id text unique,
  state text not null,
  refunded_product_minor bigint not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id),
  order_id uuid not null unique references purchase_orders (id),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  state text not null check (state in ('active', 'revoked')),
  check (ends_at > starts_at)
);

create table if not exists commission_ledger (
  id uuid primary key default gen_random_uuid(),
  economic_key text not null unique,
  referrer_user_id uuid not null,
  referred_user_id uuid not null,
  order_id uuid not null references purchase_orders (id),
  payment_id text not null,
  currency text not null,
  amount_minor bigint not null,
  reversed_minor bigint not null default 0,
  reserved_minor bigint not null default 0,
  paid_minor bigint not null default 0,
  available_at timestamptz not null,
  frozen boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists app_bootstrap (
  id integer primary key check (id = 1),
  user_id uuid not null references auth.users (id),
  consumed_at timestamptz not null default now()
);

create table if not exists audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_id text not null,
  action text not null,
  object_id text not null,
  summary text not null,
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;
alter table user_roles enable row level security;
alter table user_preferences enable row level security;
alter table jobs_current enable row level security;
alter table jobs_archive enable row level security;
alter table saved_jobs enable row level security;
alter table application_events enable row level security;
alter table purchase_orders enable row level security;
alter table entitlements enable row level security;
alter table commission_ledger enable row level security;
alter table sources enable row level security;

revoke all on jobs_current, jobs_archive, sources, user_roles, commission_ledger from anon, authenticated;

create policy profiles_select_own on profiles for select to authenticated using (user_id = auth.uid());
create policy profiles_update_own on profiles for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy preferences_own on user_preferences for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy saves_own on saved_jobs for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy activity_own on application_events for select to authenticated using (user_id = auth.uid());
create policy orders_own on purchase_orders for select to authenticated using (user_id = auth.uid());
create policy entitlements_own on entitlements for select to authenticated using (user_id = auth.uid());

-- One-time admin bind. The email is an allowlist, not a password.
create or replace function bootstrap_admin()
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
  insert into audit_events (actor_id, action, object_id, summary)
  values (auth.uid()::text, 'bootstrap_admin', auth.uid()::text, 'Bound the initial admin.');
end;
$$;

revoke all on function bootstrap_admin() from public;
grant execute on function bootstrap_admin() to authenticated;
