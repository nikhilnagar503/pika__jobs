-- Server-only tables: enable RLS with no client policies, and revoke Data API access.
alter table public.companies enable row level security;
alter table public.job_identity enable row level security;
alter table public.plans enable row level security;
alter table public.app_bootstrap enable row level security;
alter table public.audit_events enable row level security;

revoke all on public.companies, public.job_identity, public.plans, public.app_bootstrap, public.audit_events from anon, authenticated;

revoke execute on function public.bootstrap_admin() from public, anon;
grant execute on function public.bootstrap_admin() to authenticated;
