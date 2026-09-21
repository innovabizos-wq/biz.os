create table if not exists public.brain_skill_executions (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  usuario_id uuid not null references auth.users(id) on delete cascade,
  skill_id text not null,
  idempotency_key text not null,
  input_hash text not null,
  invocation_id text not null,
  status text not null default 'running'
    check (status in ('running', 'succeeded', 'failed')),
  result jsonb,
  error jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (empresa_id, usuario_id, skill_id, idempotency_key)
);

create index if not exists brain_skill_executions_lookup_idx
  on public.brain_skill_executions (empresa_id, usuario_id, skill_id, started_at desc);

alter table public.brain_skill_executions enable row level security;

revoke all on table public.brain_skill_executions from anon, authenticated;
grant select, insert, update on table public.brain_skill_executions to authenticated;

create policy brain_skill_executions_select_own
  on public.brain_skill_executions
  for select
  to authenticated
  using (
    empresa_id = (select public.current_empresa_id())
    and usuario_id = (select auth.uid())
  );

create policy brain_skill_executions_insert_own
  on public.brain_skill_executions
  for insert
  to authenticated
  with check (
    empresa_id = (select public.current_empresa_id())
    and usuario_id = (select auth.uid())
  );

create policy brain_skill_executions_update_own
  on public.brain_skill_executions
  for update
  to authenticated
  using (
    empresa_id = (select public.current_empresa_id())
    and usuario_id = (select auth.uid())
  )
  with check (
    empresa_id = (select public.current_empresa_id())
    and usuario_id = (select auth.uid())
  );

comment on table public.brain_skill_executions is
  'Durable idempotency ledger for Biz.Brain Business Skill executions.';
