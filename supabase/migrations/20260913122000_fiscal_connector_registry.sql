-- Provider-neutral fiscal connection registry. Secret values are encrypted by the
-- application before storage; clients can only see non-secret connection state.

create table if not exists public.fiscal_connector_catalog (
  code text primary key,
  name text not null,
  connection_mode text not null,
  capabilities jsonb not null default '[]'::jsonb,
  supports_testing boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fiscal_connector_catalog_mode_check
    check (connection_mode in ('credentials', 'oauth', 'certificate', 'configurable_rest')),
  constraint fiscal_connector_catalog_capabilities_check
    check (jsonb_typeof(capabilities) = 'array')
);

insert into public.fiscal_connector_catalog (
  code,
  name,
  connection_mode,
  capabilities,
  supports_testing
)
values
  ('gti', 'GTI', 'credentials', '["issue","status","artifacts","credit_note","debit_note"]'::jsonb, true),
  ('factura_profesional', 'FacturaProfesional', 'credentials', '["issue","status","artifacts"]'::jsonb, true),
  ('alegra', 'Alegra', 'credentials', '["customers","products","taxes","issue","status"]'::jsonb, true),
  ('hacienda', 'Hacienda directo', 'certificate', '["issue","status","artifacts","receiver_messages","purchase_invoice","export_invoice","electronic_payment_receipt"]'::jsonb, true),
  ('rest', 'REST configurable', 'configurable_rest', '["issue","status","artifacts"]'::jsonb, true),
  ('tico_factura_import', 'Tico Factura (importación)', 'credentials', '["import"]'::jsonb, false)
on conflict (code) do update
set name = excluded.name,
    connection_mode = excluded.connection_mode,
    capabilities = excluded.capabilities,
    supports_testing = excluded.supports_testing,
    updated_at = now();

create table if not exists public.company_fiscal_connections (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  provider_code text not null references public.fiscal_connector_catalog(code),
  name text not null,
  environment text not null default 'testing',
  status text not null default 'draft',
  public_config jsonb not null default '{}'::jsonb,
  encrypted_credentials text,
  capabilities jsonb not null default '[]'::jsonb,
  last_verified_at timestamptz,
  last_error text,
  activated_at timestamptz,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint company_fiscal_connections_environment_check
    check (environment in ('testing', 'production')),
  constraint company_fiscal_connections_status_check
    check (status in ('draft', 'verified', 'active', 'error', 'disabled')),
  constraint company_fiscal_connections_capabilities_check
    check (jsonb_typeof(capabilities) = 'array'),
  constraint company_fiscal_connections_company_name_unique
    unique (empresa_id, name),
  constraint company_fiscal_connections_id_empresa_unique
    unique (id, empresa_id),
  constraint company_fiscal_connections_created_by_empresa_fkey
    foreign key (created_by, empresa_id)
    references public.profiles(id, empresa_id)
    on delete set null (created_by),
  constraint company_fiscal_connections_updated_by_empresa_fkey
    foreign key (updated_by, empresa_id)
    references public.profiles(id, empresa_id)
    on delete set null (updated_by)
);

create unique index if not exists company_fiscal_connections_one_active_idx
  on public.company_fiscal_connections (empresa_id)
  where status = 'active';

create index if not exists company_fiscal_connections_company_status_idx
  on public.company_fiscal_connections (empresa_id, status, updated_at desc);

drop trigger if exists set_fiscal_connector_catalog_updated_at on public.fiscal_connector_catalog;
create trigger set_fiscal_connector_catalog_updated_at
before update on public.fiscal_connector_catalog
for each row execute function public.set_updated_at();

drop trigger if exists set_company_fiscal_connections_updated_at on public.company_fiscal_connections;
create trigger set_company_fiscal_connections_updated_at
before update on public.company_fiscal_connections
for each row execute function public.set_updated_at();

alter table public.fiscal_connector_catalog enable row level security;
alter table public.company_fiscal_connections enable row level security;

grant select on table public.fiscal_connector_catalog to authenticated;
grant select on table public.company_fiscal_connections to authenticated;

drop policy if exists fiscal_connector_catalog_read on public.fiscal_connector_catalog;
create policy fiscal_connector_catalog_read
on public.fiscal_connector_catalog for select to authenticated
using (is_active = true);

drop policy if exists company_fiscal_connections_read on public.company_fiscal_connections;
create policy company_fiscal_connections_read
on public.company_fiscal_connections for select to authenticated
using (
  empresa_id = (select public.current_empresa_id())
  and (
    (select public.current_user_has_permission('billing.config.view'))
    or (select public.current_user_has_permission('billing.config.manage'))
  )
);

-- Return only fields safe for authenticated browser clients.
create or replace function public.list_fiscal_connections()
returns table (
  id uuid,
  provider_code text,
  name text,
  environment text,
  status text,
  public_config jsonb,
  capabilities jsonb,
  has_credentials boolean,
  last_verified_at timestamptz,
  last_error text,
  activated_at timestamptz,
  updated_at timestamptz
)
language sql
security definer
set search_path = ''
stable
as $$
  select
    c.id,
    c.provider_code,
    c.name,
    c.environment,
    c.status,
    c.public_config,
    c.capabilities,
    c.encrypted_credentials is not null,
    c.last_verified_at,
    c.last_error,
    c.activated_at,
    c.updated_at
  from public.company_fiscal_connections as c
  where c.empresa_id = public.current_empresa_id()
    and (
      public.current_user_has_permission('billing.config.view')
      or public.current_user_has_permission('billing.config.manage')
    )
  order by c.updated_at desc;
$$;

revoke all on table public.company_fiscal_connections from anon, authenticated;
grant select on table public.company_fiscal_connections to service_role;
grant insert, update, delete on table public.company_fiscal_connections to service_role;

revoke all on function public.list_fiscal_connections() from public, anon;
grant execute on function public.list_fiscal_connections() to authenticated;

create or replace function public.save_fiscal_connection(
  p_connection_id uuid,
  p_provider_code text,
  p_name text,
  p_environment text,
  p_public_config jsonb,
  p_encrypted_credentials text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_company_id uuid := public.current_empresa_id();
  v_id uuid;
begin
  if v_user_id is null or v_company_id is null then
    raise exception 'Usuario autenticado requerido.' using errcode = '28000';
  end if;
  if not public.current_user_has_permission('billing.config.manage')
    and not public.current_user_has_permission('billing.fiscal.manage')
    and not public.current_user_has_permission('admin.settings.manage') then
    raise exception 'Permiso de configuración fiscal requerido.' using errcode = '42501';
  end if;
  if p_environment not in ('testing', 'production')
    or nullif(btrim(coalesce(p_name, '')), '') is null
    or jsonb_typeof(coalesce(p_public_config, '{}'::jsonb)) <> 'object'
    or not exists (
      select 1 from public.fiscal_connector_catalog as catalog
      where catalog.code = p_provider_code and catalog.is_active = true
    ) then
    raise exception 'Configuración de conexión fiscal inválida.' using errcode = '22023';
  end if;

  if p_connection_id is null then
    insert into public.company_fiscal_connections (
      empresa_id, provider_code, name, environment, status, public_config,
      encrypted_credentials, created_by, updated_by
    ) values (
      v_company_id, p_provider_code, btrim(p_name), p_environment, 'draft',
      coalesce(p_public_config, '{}'::jsonb), p_encrypted_credentials, v_user_id, v_user_id
    ) returning id into v_id;
  else
    update public.company_fiscal_connections as connection
    set provider_code = p_provider_code,
        name = btrim(p_name),
        environment = p_environment,
        status = 'draft',
        public_config = coalesce(p_public_config, '{}'::jsonb),
        encrypted_credentials = coalesce(p_encrypted_credentials, connection.encrypted_credentials),
        capabilities = '[]'::jsonb,
        last_verified_at = null,
        last_error = null,
        updated_by = v_user_id
    where connection.id = p_connection_id and connection.empresa_id = v_company_id
    returning id into v_id;
    if v_id is null then raise exception 'Conexión fiscal no encontrada.' using errcode = '02000'; end if;
  end if;
  return v_id;
end;
$$;

create or replace function public.record_fiscal_connection_verification(
  p_connection_id uuid,
  p_success boolean,
  p_capabilities jsonb,
  p_error text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company_id uuid := public.current_empresa_id();
  v_updated integer;
begin
  if auth.uid() is null or v_company_id is null then raise exception 'Usuario autenticado requerido.' using errcode = '28000'; end if;
  if not public.current_user_has_permission('billing.config.manage')
    and not public.current_user_has_permission('billing.fiscal.manage')
    and not public.current_user_has_permission('admin.settings.manage') then
    raise exception 'Permiso de configuración fiscal requerido.' using errcode = '42501';
  end if;
  update public.company_fiscal_connections as connection
  set status = case when p_success then 'verified' else 'error' end,
      capabilities = case when p_success then coalesce(p_capabilities, '[]'::jsonb) else '[]'::jsonb end,
      last_verified_at = now(),
      last_error = case when p_success then null else left(coalesce(p_error, 'Error de verificación'), 2000) end,
      updated_by = auth.uid()
  where connection.id = p_connection_id and connection.empresa_id = v_company_id;
  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

create or replace function public.activate_fiscal_connection(p_connection_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company_id uuid := public.current_empresa_id();
  v_updated integer;
begin
  if auth.uid() is null or v_company_id is null then raise exception 'Usuario autenticado requerido.' using errcode = '28000'; end if;
  if not public.current_user_has_permission('billing.config.manage')
    and not public.current_user_has_permission('billing.fiscal.manage')
    and not public.current_user_has_permission('admin.settings.manage') then
    raise exception 'Permiso de configuración fiscal requerido.' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(v_company_id::text || ':fiscal.connection.activate', 0));
  if not exists (
    select 1 from public.company_fiscal_connections as connection
    where connection.id = p_connection_id and connection.empresa_id = v_company_id
      and connection.status in ('verified', 'active')
  ) then return false; end if;
  update public.company_fiscal_connections set status = 'verified', activated_at = null, updated_by = auth.uid()
  where empresa_id = v_company_id and status = 'active' and id <> p_connection_id;
  update public.company_fiscal_connections set status = 'active', activated_at = now(), last_error = null, updated_by = auth.uid()
  where empresa_id = v_company_id and id = p_connection_id and status in ('verified', 'active');
  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$$;

revoke all on function public.save_fiscal_connection(uuid, text, text, text, jsonb, text) from public, anon;
revoke all on function public.record_fiscal_connection_verification(uuid, boolean, jsonb, text) from public, anon;
revoke all on function public.activate_fiscal_connection(uuid) from public, anon;
grant execute on function public.save_fiscal_connection(uuid, text, text, text, jsonb, text) to authenticated;
grant execute on function public.record_fiscal_connection_verification(uuid, boolean, jsonb, text) to authenticated;
grant execute on function public.activate_fiscal_connection(uuid) to authenticated;
