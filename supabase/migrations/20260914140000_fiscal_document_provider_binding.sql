begin;

-- A fiscal document must keep using the exact provider connection that was
-- selected before its first irreversible fiscal step. Changing the company's
-- active connection must never redirect an existing document.
alter table public.fiscal_documents
  add column if not exists fiscal_connection_id uuid,
  add column if not exists provider_code text,
  add column if not exists provider_environment text,
  add column if not exists provider_document_id text,
  add column if not exists provider_reference text,
  add column if not exists provider_status text,
  add column if not exists provider_bound_at timestamptz,
  add column if not exists provider_last_response_at timestamptz,
  add column if not exists provider_metadata jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'fiscal_documents_connection_empresa_fkey'
      and conrelid = 'public.fiscal_documents'::regclass
  ) then
    alter table public.fiscal_documents
      add constraint fiscal_documents_connection_empresa_fkey
      foreign key (fiscal_connection_id, empresa_id)
      references public.company_fiscal_connections(id, empresa_id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'fiscal_documents_provider_code_fkey'
      and conrelid = 'public.fiscal_documents'::regclass
  ) then
    alter table public.fiscal_documents
      add constraint fiscal_documents_provider_code_fkey
      foreign key (provider_code)
      references public.fiscal_connector_catalog(code);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'fiscal_documents_provider_environment_check'
      and conrelid = 'public.fiscal_documents'::regclass
  ) then
    alter table public.fiscal_documents
      add constraint fiscal_documents_provider_environment_check
      check (provider_environment is null or provider_environment in ('testing', 'production'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'fiscal_documents_provider_binding_complete_check'
      and conrelid = 'public.fiscal_documents'::regclass
  ) then
    alter table public.fiscal_documents
      add constraint fiscal_documents_provider_binding_complete_check
      check (
        (fiscal_connection_id is null and provider_code is null and provider_environment is null and provider_bound_at is null)
        or
        (fiscal_connection_id is not null and provider_code is not null and provider_environment is not null and provider_bound_at is not null)
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'fiscal_documents_provider_metadata_object_check'
      and conrelid = 'public.fiscal_documents'::regclass
  ) then
    alter table public.fiscal_documents
      add constraint fiscal_documents_provider_metadata_object_check
      check (jsonb_typeof(provider_metadata) = 'object');
  end if;
end;
$$;

create index if not exists fiscal_documents_connection_idx
  on public.fiscal_documents (fiscal_connection_id)
  where fiscal_connection_id is not null;

create index if not exists fiscal_documents_provider_status_idx
  on public.fiscal_documents (empresa_id, provider_code, provider_status, updated_at desc)
  where provider_code is not null;

create unique index if not exists fiscal_documents_provider_document_unique
  on public.fiscal_documents (empresa_id, provider_code, provider_document_id)
  where provider_code is not null and provider_document_id is not null;

create or replace function public.protect_fiscal_document_provider_binding()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.fiscal_connection_id is null and new.fiscal_connection_id is not null then
    if coalesce(current_setting('app.fiscal_provider_binding', true), '') <> 'allowed' then
      raise exception 'La conexión fiscal solo puede asignarse mediante la operación autorizada.'
        using errcode = '42501';
    end if;
  elsif old.fiscal_connection_id is not null and (
    new.fiscal_connection_id is distinct from old.fiscal_connection_id
    or new.provider_code is distinct from old.provider_code
    or new.provider_environment is distinct from old.provider_environment
    or new.provider_bound_at is distinct from old.provider_bound_at
  ) then
    raise exception 'La conexión fiscal asignada al documento es inmutable.'
      using errcode = '22023';
  end if;

  if old.provider_document_id is not null
    and new.provider_document_id is distinct from old.provider_document_id then
    raise exception 'La identidad externa del documento fiscal es inmutable.'
      using errcode = '22023';
  end if;

  if old.provider_reference is not null
    and new.provider_reference is distinct from old.provider_reference then
    raise exception 'La referencia externa del documento fiscal es inmutable.'
      using errcode = '22023';
  end if;

  return new;
end;
$$;

drop trigger if exists protect_fiscal_document_provider_binding on public.fiscal_documents;
create trigger protect_fiscal_document_provider_binding
before update on public.fiscal_documents
for each row execute function public.protect_fiscal_document_provider_binding();

create or replace function public.protect_bound_fiscal_connection_identity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (
    new.provider_code is distinct from old.provider_code
    or new.environment is distinct from old.environment
  ) and exists (
    select 1
    from public.fiscal_documents as document
    where document.fiscal_connection_id = old.id
  ) then
    raise exception 'Esta conexión ya pertenece a documentos fiscales. Crea una conexión nueva para cambiar proveedor o ambiente.'
      using errcode = '22023';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_bound_fiscal_connection_identity on public.company_fiscal_connections;
create trigger protect_bound_fiscal_connection_identity
before update of provider_code, environment on public.company_fiscal_connections
for each row execute function public.protect_bound_fiscal_connection_identity();

create or replace function public.bind_fiscal_document_connection_internal(
  p_document_id uuid,
  p_empresa_id uuid
)
returns table (
  fiscal_connection_id uuid,
  provider_code text,
  provider_environment text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_document public.fiscal_documents%rowtype;
  v_connection public.company_fiscal_connections%rowtype;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_empresa_id::text || ':fiscal.document.bind:' || p_document_id::text, 0));

  select document.*
  into v_document
  from public.fiscal_documents as document
  where document.id = p_document_id
    and document.empresa_id = p_empresa_id
  for update;

  if v_document.id is null then
    raise exception 'Documento fiscal no encontrado.' using errcode = 'P0002';
  end if;

  if v_document.fiscal_connection_id is not null then
    select connection.*
    into v_connection
    from public.company_fiscal_connections as connection
    where connection.id = v_document.fiscal_connection_id
      and connection.empresa_id = p_empresa_id;

    if v_connection.id is null
      or v_connection.provider_code <> v_document.provider_code
      or v_connection.environment <> v_document.provider_environment then
      raise exception 'La conexión fiscal guardada ya no coincide con el documento.' using errcode = '23514';
    end if;

    return query select v_connection.id, v_connection.provider_code, v_connection.environment;
    return;
  end if;

  -- An already signed or submitted legacy document cannot be associated by
  -- guessing from today's active provider.
  if v_document.status not in ('validated', 'xml_generated')
    or v_document.hacienda_status <> 'no_enviado' then
    raise exception 'El documento inició su proceso fiscal sin conexión registrada y requiere conciliación manual.'
      using errcode = '55000';
  end if;

  select connection.*
  into v_connection
  from public.company_fiscal_connections as connection
  where connection.empresa_id = p_empresa_id
    and connection.status = 'active'
    and connection.environment = v_document.environment
  for share;

  if v_connection.id is null then
    raise exception 'No hay una conexión fiscal activa en el mismo ambiente del documento.'
      using errcode = '55000';
  end if;

  perform set_config('app.fiscal_provider_binding', 'allowed', true);

  update public.fiscal_documents as document
  set fiscal_connection_id = v_connection.id,
      provider_code = v_connection.provider_code,
      provider_environment = v_connection.environment,
      provider_bound_at = now(),
      provider_metadata = jsonb_build_object(
        'connectionName', v_connection.name,
        'boundFromStatus', v_document.status
      )
  where document.id = v_document.id
    and document.empresa_id = p_empresa_id
    and document.fiscal_connection_id is null;

  return query select v_connection.id, v_connection.provider_code, v_connection.environment;
end;
$$;

create or replace function public.bind_fiscal_document_connection(
  p_document_id uuid
)
returns table (
  fiscal_connection_id uuid,
  provider_code text,
  provider_environment text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_empresa_id uuid := public.current_empresa_id();
begin
  if auth.uid() is null or v_empresa_id is null then
    raise exception 'Usuario autenticado requerido.' using errcode = '28000';
  end if;
  if not (
    public.current_user_has_permission('billing.issue')
    or public.current_user_has_permission('billing.invoices.create')
  ) then
    raise exception 'Permiso billing.issue requerido.' using errcode = '42501';
  end if;

  return query
  select binding.fiscal_connection_id, binding.provider_code, binding.provider_environment
  from public.bind_fiscal_document_connection_internal(p_document_id, v_empresa_id) as binding;
end;
$$;

create or replace function public.bind_fiscal_document_connection_from_outbox(
  p_document_id uuid,
  p_job_id uuid,
  p_lease_token uuid
)
returns table (
  fiscal_connection_id uuid,
  provider_code text,
  provider_environment text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_empresa_id uuid;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Operación reservada al procesador interno.' using errcode = '42501';
  end if;

  select job.empresa_id
  into v_empresa_id
  from public.integration_outbox as job
  where job.id = p_job_id
    and job.lease_token = p_lease_token
    and job.status = 'processing'
    and job.topic in ('fiscal.issue', 'fiscal.status')
    and job.lock_expires_at > now();

  if v_empresa_id is null then
    raise exception 'Reserva de trabajo fiscal inválida o vencida.' using errcode = '55000';
  end if;

  return query
  select binding.fiscal_connection_id, binding.provider_code, binding.provider_environment
  from public.bind_fiscal_document_connection_internal(p_document_id, v_empresa_id) as binding;
end;
$$;

revoke all on function public.bind_fiscal_document_connection_internal(uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function public.bind_fiscal_document_connection(uuid) from public, anon;
revoke all on function public.bind_fiscal_document_connection_from_outbox(uuid, uuid, uuid) from public, anon, authenticated;

grant execute on function public.bind_fiscal_document_connection(uuid) to authenticated;
grant execute on function public.bind_fiscal_document_connection_from_outbox(uuid, uuid, uuid) to service_role;

commit;
