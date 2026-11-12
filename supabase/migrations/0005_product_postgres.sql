-- Product database in Postgres (source of truth).
-- Auth stays in auth.users + profiles / user_roles / user_preferences / app_bootstrap.
-- Jobs, saves, and admin data live here — not in store.json.

create table if not exists public.members (
  user_id text primary key,
  email text not null,
  display_name text not null default '',
  country_code text not null default 'IN',
  current_stage text not null default '',
  onboarding_step integer not null default 0,
  onboarding_completed boolean not null default false,
  adult_confirmed boolean not null default false,
  roles text[] not null default '{}',
  suspended boolean not null default false,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index if not exists members_email_live_idx
  on public.members (lower(email))
  where deleted_at is null;

create table if not exists public.member_preferences (
  user_id text primary key references public.members (user_id) on delete cascade,
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
  job_pay_target_minor bigint,
  internship_pay_target_minor bigint,
  other_role_note text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists public.companies (
  id text primary key,
  normalized_name text not null unique,
  display_name text not null
);

create table if not exists public.sources (
  id text primary key,
  name text not null,
  type text not null,
  canonical_domain text not null default '',
  permission_basis text not null default '',
  enabled boolean not null default true,
  board_id text not null default '',
  last_success_at timestamptz
);

create table if not exists public.jobs (
  job_id text primary key,
  bucket text not null check (bucket in ('draft', 'current', 'archive')),
  version integer not null default 1,
  title text not null,
  company_name text not null,
  company_id text not null default '',
  summary text not null default '',
  opportunity_kind text not null,
  employment_arrangement text not null default '',
  sector text not null default '',
  work_mode text not null default '',
  seniority text not null default '',
  role_family_slug text,
  industry_slug text,
  location_label text not null default '',
  location_unknown boolean not null default false,
  country_code text,
  eligible_countries text[] not null default '{}',
  skills text[] not null default '{}',
  requirements text[] not null default '{}',
  eligibility text[] not null default '{}',
  responsibilities text[] not null default '{}',
  batch_label text,
  duration_label text,
  original_source_label text,
  pay_display_label text,
  apply_note text,
  compensation_type text not null default 'not_disclosed',
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
  source_id text not null,
  source_url text not null,
  external_job_id text,
  source_published_at timestamptz,
  date_precision text not null default 'instant',
  first_seen_at timestamptz not null,
  effective_job_at timestamptz not null,
  visible_until timestamptz not null,
  published_at timestamptz,
  last_checked_at timestamptz,
  deadline_at timestamptz,
  access_tier text not null default 'free',
  verification text not null default 'unreviewed',
  lifecycle text not null,
  government jsonb,
  evidence jsonb not null default '[]'::jsonb,
  archive_reason text,
  archived_at timestamptz
);

create index if not exists jobs_bucket_visible_idx on public.jobs (bucket, visible_until);
create index if not exists jobs_bucket_published_idx on public.jobs (bucket, published_at desc);

create table if not exists public.job_versions (
  job_id text not null,
  version integer not null,
  summary text not null default '',
  actor_id text not null default '',
  at timestamptz not null default now(),
  primary key (job_id, version)
);

create table if not exists public.agent_credentials (
  id text primary key,
  name text not null,
  owner_id text not null,
  prefix text not null,
  digest text not null,
  scopes text[] not null default '{}',
  source_ids text[] not null default '{}',
  expires_at timestamptz not null,
  revoked_at timestamptz,
  daily_limit integer not null default 0,
  used_today integer not null default 0,
  used_on text not null default '',
  last_used_at timestamptz
);

create table if not exists public.intake_batches (
  id text primary key,
  credential_id text,
  actor_user_id text,
  idempotency_key text not null,
  body_hash text not null,
  dry_run boolean not null default false,
  received_at timestamptz not null default now(),
  result jsonb not null default '{}'::jsonb
);

create table if not exists public.saved_jobs (
  user_id text not null,
  job_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, job_id)
);

create table if not exists public.application_events (
  id text primary key,
  user_id text not null,
  job_id text not null,
  kind text not null check (kind in ('opened', 'applied')),
  occurred_at timestamptz not null default now()
);

create table if not exists public.audit_events (
  id text primary key,
  actor_id text not null,
  action text not null,
  object_id text not null,
  summary text not null default '',
  at timestamptz not null default now()
);

create table if not exists public.app_flags (
  key text primary key,
  value boolean not null
);

create table if not exists public.app_state (
  id integer primary key check (id = 1),
  demo_seed_version text not null default '',
  bootstrap_consumed boolean not null default false
);

insert into public.app_state (id, demo_seed_version, bootstrap_consumed)
values (1, '', false)
on conflict (id) do nothing;

insert into public.app_flags (key, value)
values ('publication_paused', false)
on conflict (key) do nothing;

alter table public.members enable row level security;
alter table public.member_preferences enable row level security;
alter table public.companies enable row level security;
alter table public.sources enable row level security;
alter table public.jobs enable row level security;
alter table public.job_versions enable row level security;
alter table public.agent_credentials enable row level security;
alter table public.intake_batches enable row level security;
alter table public.saved_jobs enable row level security;
alter table public.application_events enable row level security;
alter table public.audit_events enable row level security;
alter table public.app_flags enable row level security;
alter table public.app_state enable row level security;

revoke all on public.members, public.member_preferences, public.companies, public.sources,
  public.jobs, public.job_versions, public.agent_credentials, public.intake_batches,
  public.saved_jobs, public.application_events, public.audit_events, public.app_flags, public.app_state
  from anon, authenticated;
