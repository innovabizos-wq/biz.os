-- Safe operator visibility and worker-only bridges for the persistent outbox.
-- The bridges validate the active lease and original actor before delegating to
-- existing fiscal RPCs. No browser token is stored in a queued job.

create or replace function public.list_integration_outbox_jobs(
  p_status text default 'open',
  p_limit integer default 50
)
returns table (
  id uuid,
  topic text,
  aggregate_type text,
  aggregate_id uuid,
  status text,
  attempts integer,
  max_attempts integer,
  available_at timestamptz,
  last_error text,
  result jsonb,
  created_at timestamptz,
  updated_at timestamptz,
  completed_at timestamptz
)
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  v_company_id uuid := public.current_empresa_id();
begin
  if auth.uid() is null or v_company_id is null then
    raise exception 'Usuario autenticado requerido.' using errcode = '28000';
  end if;
  if not (
    public.current_user_has_permission('billing.config.view')
    or public.current_user_has_permission('billing.config.manage')
    or public.current_user_has_permission('billing.fiscal.view')
    or public.current_user_has_permission('billing.fiscal.manage')
    or public.current_user_has_permission('admin.settings.view')
    or public.current_user_has_permission('admin.settings.manage')
  ) then
    raise exception 'Permiso para consultar integraciones requerido.' using errcode = '42501';
  end if;
  if p_status not in ('open', 'queued', 'processing', 'retry', 'succeeded', 'dead', 'all') then
    raise exception 'Filtro de estado invalido.' using errcode = '22023';
  end if;
  if p_limit not between 1 and 100 then
    raise exception 'Limite invalido.' using errcode = '22023';
  end if;

  return query
  select
    job.id,
    job.topic,
    job.aggregate_type,
    job.aggregate_id,
    job.status,
    job.attempts,
    job.max_attempts,
    job.available_at,
    job.last_error,
    job.result,
    job.created_at,
    job.updated_at,
    job.completed_at
  from public.integration_outbox as job
  where job.empresa_id = v_company_id
    and (
      p_status = 'all'
      or (p_status = 'open' and job.status in ('queued', 'processing', 'retry', 'dead'))
      or job.status = p_status
    )
  order by
    case job.status when 'dead' then 0 when 'retry' then 1 when 'processing' then 2 else 3 end,
    job.updated_at desc
  limit p_limit;
end;
$$;

create or replace function public.retry_integration_outbox_job(p_job_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company_id uuid := public.current_empresa_id();
  v_updated integer;
begin
  if auth.uid() is null or v_company_id is null then
    raise exception 'Usuario autenticado requerido.' using errcode = '28000';
  end if;
  if not (
    public.current_user_has_permission('billing.config.manage')
    or public.current_user_has_permission('billing.fiscal.manage')
    or public.current_user_has_permission('admin.settings.manage')
  ) then
    raise exception 'Permiso para reintentar integraciones requerido.' using errcode = '42501';
  end if;

  update public.integration_outbox as job
  set status = 'queued',
      attempts = 0,
      available_at = now(),
      lease_token = null,
      locked_until = null,
      last_error = null,
      completed_at = null,
      updated_at = now()
  where job.id = p_job_id
    and job.empresa_id = v_company_id
    and job.status in ('retry', 'dead');

  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

create or replace function public.dead_letter_integration_outbox(
  p_job_id uuid,
  p_lease_token uuid,
  p_error text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_updated integer;
begin
  if coalesce(auth.jwt()->>'role', '') <> 'service_role' then
    raise exception 'Service role requerido.' using errcode = '42501';
  end if;

  update public.integration_outbox as job
  set status = 'dead',
      last_error = left(coalesce(nullif(btrim(p_error), ''), 'Error de integracion no recuperable'), 4000),
      lease_token = null,
      locked_until = null,
      completed_at = now(),
      updated_at = now()
  where job.id = p_job_id
    and job.status = 'processing'
    and job.lease_token = p_lease_token;

  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

create or replace function public.prepare_fiscal_document_from_outbox(
  p_job_id uuid,
  p_lease_token uuid,
  p_document_type_code text default '01'
)
returns table (document_id uuid, status text, validation_errors jsonb)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.integration_outbox%rowtype;
  v_existing public.fiscal_documents%rowtype;
begin
  if coalesce(auth.jwt()->>'role', '') <> 'service_role' then
    raise exception 'Service role requerido.' using errcode = '42501';
  end if;

  select job.* into v_job
  from public.integration_outbox as job
  where job.id = p_job_id
    and job.status = 'processing'
    and job.lease_token = p_lease_token
    and job.topic = 'fiscal.issue'
  for update;

  if v_job.id is null or v_job.aggregate_id is null or v_job.created_by is null then
    raise exception 'Tarea fiscal o reserva de trabajo invalida.' using errcode = '40001';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_job.empresa_id::text || ':fiscal.sale:' || v_job.aggregate_id::text, 0));

  select document.* into v_existing
  from public.fiscal_documents as document
  where document.empresa_id = v_job.empresa_id
    and document.sale_id = v_job.aggregate_id
    and document.status not in ('cancelled_internal', 'replaced')
  order by document.created_at desc
  limit 1;

  if v_existing.id is not null then
    return query select v_existing.id, v_existing.status, v_existing.validation_errors;
    return;
  end if;

  if not exists (
    select 1
    from public.profiles as profile
    join public.rol_permisos as role_permission
      on role_permission.empresa_id = profile.empresa_id
     and role_permission.rol_id = profile.rol_id
    join public.permisos as permission on permission.id = role_permission.permiso_id
    where profile.id = v_job.created_by
      and profile.empresa_id = v_job.empresa_id
      and profile.estado = 'activo'
      and permission.estado = 'activo'
      and permission.codigo in ('billing.issue', 'billing.invoices.create')
  ) then
    raise exception 'El usuario que origino la venta ya no tiene permiso fiscal.' using errcode = '42501';
  end if;

  perform set_config('request.jwt.claim.sub', v_job.created_by::text, true);
  return query
  select prepared.document_id, prepared.status, prepared.validation_errors
  from public.prepare_fiscal_document_from_sale(v_job.aggregate_id, p_document_type_code) as prepared;
end;
$$;

create or replace function public.reserve_fiscal_sequence_from_outbox(
  p_job_id uuid,
  p_lease_token uuid,
  p_environment text,
  p_branch_code text,
  p_terminal_code text,
  p_document_type_code text
)
returns table (reservation_id uuid, consecutivo text, sequence_number bigint)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.integration_outbox%rowtype;
begin
  if coalesce(auth.jwt()->>'role', '') <> 'service_role' then
    raise exception 'Service role requerido.' using errcode = '42501';
  end if;

  select job.* into v_job
  from public.integration_outbox as job
  where job.id = p_job_id
    and job.status = 'processing'
    and job.lease_token = p_lease_token
    and job.topic in ('fiscal.issue', 'fiscal.status')
  for update;

  if v_job.id is null or v_job.created_by is null then
    raise exception 'Tarea fiscal o reserva de trabajo invalida.' using errcode = '40001';
  end if;

  perform set_config('request.jwt.claim.sub', v_job.created_by::text, true);
  if public.current_empresa_id() is distinct from v_job.empresa_id
    or not (
      public.current_user_has_permission('billing.issue')
      or public.current_user_has_permission('billing.invoices.create')
    ) then
    raise exception 'El usuario que origino la tarea ya no tiene permiso fiscal.' using errcode = '42501';
  end if;

  return query
  select reservation.reservation_id, reservation.consecutivo, reservation.sequence_number
  from public.reserve_fiscal_sequence_for_current_company(
    p_document_type_code,
    p_environment,
    p_branch_code,
    p_terminal_code
  ) as reservation;
end;
$$;

revoke all on function public.list_integration_outbox_jobs(text, integer) from public, anon;
revoke all on function public.retry_integration_outbox_job(uuid) from public, anon;
revoke all on function public.dead_letter_integration_outbox(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.prepare_fiscal_document_from_outbox(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.reserve_fiscal_sequence_from_outbox(uuid, uuid, text, text, text, text) from public, anon, authenticated;

grant execute on function public.list_integration_outbox_jobs(text, integer) to authenticated;
grant execute on function public.retry_integration_outbox_job(uuid) to authenticated;
grant execute on function public.dead_letter_integration_outbox(uuid, uuid, text) to service_role;
grant execute on function public.prepare_fiscal_document_from_outbox(uuid, uuid, text) to service_role;
grant execute on function public.reserve_fiscal_sequence_from_outbox(uuid, uuid, text, text, text, text) to service_role;
