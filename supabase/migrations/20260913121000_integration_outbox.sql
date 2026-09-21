-- Persistent, lease-based queue for every external side effect.
-- Domain RPCs insert jobs in the same transaction as the business change.

create table if not exists public.integration_outbox (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  topic text not null,
  idempotency_key text not null,
  aggregate_type text,
  aggregate_id uuid,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued',
  attempts integer not null default 0,
  max_attempts integer not null default 8,
  available_at timestamptz not null default now(),
  lease_token uuid,
  locked_until timestamptz,
  last_error text,
  result jsonb,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint integration_outbox_status_check
    check (status in ('queued', 'processing', 'retry', 'succeeded', 'dead')),
  constraint integration_outbox_attempts_check
    check (attempts >= 0 and max_attempts between 1 and 50),
  constraint integration_outbox_key_check
    check (length(btrim(idempotency_key)) between 1 and 200),
  constraint integration_outbox_company_key_unique
    unique (empresa_id, topic, idempotency_key),
  constraint integration_outbox_created_by_empresa_fkey
    foreign key (created_by, empresa_id)
    references public.profiles(id, empresa_id)
    on delete set null (created_by)
);

create index if not exists integration_outbox_ready_idx
  on public.integration_outbox (available_at, created_at)
  where status in ('queued', 'retry');

create index if not exists integration_outbox_company_status_idx
  on public.integration_outbox (empresa_id, status, created_at desc);

create index if not exists integration_outbox_aggregate_idx
  on public.integration_outbox (empresa_id, aggregate_type, aggregate_id)
  where aggregate_id is not null;

alter table public.integration_outbox enable row level security;

revoke all on table public.integration_outbox from public, anon, authenticated;
grant select, insert, update, delete on table public.integration_outbox to service_role;

create or replace function public.claim_integration_outbox(
  p_limit integer default 25,
  p_lease_seconds integer default 120
)
returns setof public.integration_outbox
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_limit not between 1 and 100 or p_lease_seconds not between 15 and 900 then
    raise exception 'Invalid outbox claim limits.' using errcode = '22023';
  end if;

  return query
  with candidates as (
    select o.id
    from public.integration_outbox as o
    where (
        o.status in ('queued', 'retry')
        and o.available_at <= now()
      )
      or (
        o.status = 'processing'
        and o.locked_until < now()
      )
    order by o.available_at asc, o.created_at asc
    for update skip locked
    limit p_limit
  )
  update public.integration_outbox as o
  set status = 'processing',
      attempts = o.attempts + 1,
      lease_token = gen_random_uuid(),
      locked_until = now() + make_interval(secs => p_lease_seconds),
      updated_at = now()
  from candidates as c
  where o.id = c.id
  returning o.*;
end;
$$;

create or replace function public.complete_integration_outbox(
  p_job_id uuid,
  p_lease_token uuid,
  p_result jsonb default '{}'::jsonb
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_updated integer;
begin
  update public.integration_outbox as o
  set status = 'succeeded',
      result = coalesce(p_result, '{}'::jsonb),
      last_error = null,
      lease_token = null,
      locked_until = null,
      completed_at = now(),
      updated_at = now()
  where o.id = p_job_id
    and o.status = 'processing'
    and o.lease_token = p_lease_token;

  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

create or replace function public.fail_integration_outbox(
  p_job_id uuid,
  p_lease_token uuid,
  p_error text,
  p_retry_after_seconds integer default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.integration_outbox%rowtype;
  v_delay integer;
  v_status text;
begin
  select o.* into v_job
  from public.integration_outbox as o
  where o.id = p_job_id
    and o.status = 'processing'
    and o.lease_token = p_lease_token
  for update;

  if v_job.id is null then
    raise exception 'Outbox lease is no longer valid.' using errcode = '40001';
  end if;

  v_status := case when v_job.attempts >= v_job.max_attempts then 'dead' else 'retry' end;
  v_delay := coalesce(
    p_retry_after_seconds,
    least(3600, greatest(5, (power(2, least(v_job.attempts, 10)) * 5)::integer))
  );

  if v_delay not between 1 and 86400 then
    raise exception 'Invalid outbox retry delay.' using errcode = '22023';
  end if;

  update public.integration_outbox as o
  set status = v_status,
      last_error = left(coalesce(nullif(btrim(p_error), ''), 'Unknown integration error'), 4000),
      available_at = case when v_status = 'retry' then now() + make_interval(secs => v_delay) else o.available_at end,
      lease_token = null,
      locked_until = null,
      completed_at = case when v_status = 'dead' then now() else null end,
      updated_at = now()
  where o.id = v_job.id;

  return v_status;
end;
$$;

revoke all on function public.claim_integration_outbox(integer, integer) from public, anon, authenticated;
revoke all on function public.complete_integration_outbox(uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.fail_integration_outbox(uuid, uuid, text, integer) from public, anon, authenticated;

grant execute on function public.claim_integration_outbox(integer, integer) to service_role;
grant execute on function public.complete_integration_outbox(uuid, uuid, jsonb) to service_role;
grant execute on function public.fail_integration_outbox(uuid, uuid, text, integer) to service_role;
