-- Public API v1 authentication, bounded rate limiting and write idempotency ledger.

create table if not exists public.public_api_keys (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  name text not null,
  key_prefix text not null,
  secret_hash text not null,
  scopes jsonb not null default '[]'::jsonb,
  status text not null default 'active',
  rate_limit_per_minute integer not null default 120,
  expires_at timestamptz,
  last_used_at timestamptz,
  created_by uuid,
  revoked_by uuid,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint public_api_keys_id_empresa_unique unique (id, empresa_id),
  constraint public_api_keys_prefix_unique unique (key_prefix),
  constraint public_api_keys_name_company_unique unique (empresa_id, name),
  constraint public_api_keys_prefix_check check (key_prefix ~ '^[0-9a-f]{12}$'),
  constraint public_api_keys_hash_check check (secret_hash ~ '^[0-9a-f]{64}$'),
  constraint public_api_keys_scopes_array_check check (jsonb_typeof(scopes) = 'array'),
  constraint public_api_keys_status_check check (status in ('active', 'revoked')),
  constraint public_api_keys_rate_limit_check check (rate_limit_per_minute between 1 and 600),
  constraint public_api_keys_created_by_empresa_fkey
    foreign key (created_by, empresa_id) references public.profiles(id, empresa_id)
    on delete set null (created_by),
  constraint public_api_keys_revoked_by_empresa_fkey
    foreign key (revoked_by, empresa_id) references public.profiles(id, empresa_id)
    on delete set null (revoked_by)
);

create table if not exists public.public_api_rate_buckets (
  api_key_id uuid not null references public.public_api_keys(id) on delete cascade,
  window_start timestamptz not null,
  request_count integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (api_key_id, window_start),
  constraint public_api_rate_buckets_count_check check (request_count >= 0)
);

create table if not exists public.public_api_idempotency (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  api_key_id uuid not null,
  operation text not null,
  idempotency_key text not null,
  request_hash text not null,
  response_status integer,
  response_body jsonb,
  status text not null default 'processing',
  expires_at timestamptz not null default (now() + interval '24 hours'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint public_api_idempotency_key_empresa_fkey
    foreign key (api_key_id, empresa_id) references public.public_api_keys(id, empresa_id)
    on delete cascade,
  constraint public_api_idempotency_unique unique (api_key_id, operation, idempotency_key),
  constraint public_api_idempotency_key_check check (length(idempotency_key) between 8 and 200),
  constraint public_api_idempotency_hash_check check (request_hash ~ '^[0-9a-f]{64}$'),
  constraint public_api_idempotency_status_check check (status in ('processing', 'completed', 'failed')),
  constraint public_api_idempotency_response_status_check
    check (response_status is null or response_status between 100 and 599)
);

create table if not exists public.public_api_request_logs (
  id bigint generated always as identity primary key,
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  api_key_id uuid not null,
  request_id uuid not null,
  method text not null,
  path text not null,
  scope text not null,
  response_status integer,
  duration_ms integer,
  created_at timestamptz not null default now(),
  constraint public_api_request_logs_key_empresa_fkey
    foreign key (api_key_id, empresa_id) references public.public_api_keys(id, empresa_id)
    on delete cascade,
  constraint public_api_request_logs_request_unique unique (api_key_id, request_id),
  constraint public_api_request_logs_method_check check (method in ('GET','POST','PUT','PATCH','DELETE')),
  constraint public_api_request_logs_response_status_check
    check (response_status is null or response_status between 100 and 599),
  constraint public_api_request_logs_duration_check check (duration_ms is null or duration_ms >= 0)
);

create index if not exists public_api_keys_company_status_idx
  on public.public_api_keys (empresa_id, status, created_at desc);
create index if not exists public_api_idempotency_expiry_idx
  on public.public_api_idempotency (expires_at);
create index if not exists public_api_request_logs_company_created_idx
  on public.public_api_request_logs (empresa_id, created_at desc);

drop trigger if exists set_public_api_keys_updated_at on public.public_api_keys;
create trigger set_public_api_keys_updated_at before update on public.public_api_keys
for each row execute function public.set_updated_at();
drop trigger if exists set_public_api_idempotency_updated_at on public.public_api_idempotency;
create trigger set_public_api_idempotency_updated_at before update on public.public_api_idempotency
for each row execute function public.set_updated_at();

alter table public.public_api_keys enable row level security;
alter table public.public_api_rate_buckets enable row level security;
alter table public.public_api_idempotency enable row level security;
alter table public.public_api_request_logs enable row level security;

revoke all on public.public_api_keys from public, anon, authenticated;
revoke all on public.public_api_rate_buckets from public, anon, authenticated;
revoke all on public.public_api_idempotency from public, anon, authenticated;
revoke all on public.public_api_request_logs from public, anon, authenticated;
grant select, insert, update, delete on public.public_api_keys to service_role;
grant select, insert, update, delete on public.public_api_rate_buckets to service_role;
grant select, insert, update, delete on public.public_api_idempotency to service_role;
grant select, insert, update, delete on public.public_api_request_logs to service_role;
grant usage, select on sequence public.public_api_request_logs_id_seq to service_role;
grant select on public.crm_clientes to service_role;
grant select on public.catalogo_productos to service_role;
grant select on public.catalog_product_fiscal_profile to service_role;
grant select on public.ventas to service_role;
grant select on public.payments_accounts to service_role;
grant select on public.fiscal_documents to service_role;

create or replace function public.authorize_public_api_request(
  p_key_prefix text,
  p_secret_hash text,
  p_required_scope text,
  p_request_id uuid,
  p_method text,
  p_path text
)
returns table (api_key_id uuid, empresa_id uuid, key_name text, scopes jsonb)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key public.public_api_keys%rowtype;
  v_company_status text;
  v_window timestamptz := date_trunc('minute', now());
  v_count integer;
begin
  if p_key_prefix !~ '^[0-9a-f]{12}$' or p_secret_hash !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = '28000', message = 'API_KEY_INVALID';
  end if;
  if p_method not in ('GET','POST','PUT','PATCH','DELETE')
    or length(p_path) > 300
    or length(p_required_scope) > 100 then
    raise exception using errcode = '22023', message = 'API_REQUEST_INVALID';
  end if;

  select k.* into v_key
  from public.public_api_keys as k
  where k.key_prefix = p_key_prefix and k.secret_hash = p_secret_hash
  for update;
  if not found then
    raise exception using errcode = '28000', message = 'API_KEY_INVALID';
  end if;

  select e.estado into v_company_status
  from public.empresas as e
  where e.id = v_key.empresa_id;

  if v_key.status <> 'active'
    or (v_key.expires_at is not null and v_key.expires_at <= now())
    or v_company_status <> 'activa' then
    raise exception using errcode = '28000', message = 'API_KEY_INVALID';
  end if;
  if not (v_key.scopes ? p_required_scope or v_key.scopes ? '*') then
    raise exception using errcode = '42501', message = 'API_SCOPE_DENIED';
  end if;

  insert into public.public_api_rate_buckets (api_key_id, window_start, request_count)
  values (v_key.id, v_window, 1)
  on conflict on constraint public_api_rate_buckets_pkey do update
  set request_count = public.public_api_rate_buckets.request_count + 1,
      updated_at = now()
  returning request_count into v_count;

  if v_count > v_key.rate_limit_per_minute then
    raise exception using errcode = 'P0001', message = 'API_RATE_LIMITED';
  end if;

  insert into public.public_api_request_logs (
    empresa_id, api_key_id, request_id, method, path, scope
  ) values (
    v_key.empresa_id, v_key.id, p_request_id, p_method, p_path, p_required_scope
  ) on conflict on constraint public_api_request_logs_request_unique do nothing;

  update public.public_api_keys set last_used_at = now() where id = v_key.id;

  api_key_id := v_key.id;
  empresa_id := v_key.empresa_id;
  key_name := v_key.name;
  scopes := v_key.scopes;
  return next;
end;
$$;

create or replace function public.complete_public_api_request(
  p_api_key_id uuid,
  p_request_id uuid,
  p_response_status integer,
  p_duration_ms integer
)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.public_api_request_logs
  set response_status = p_response_status,
      duration_ms = greatest(0, p_duration_ms)
  where api_key_id = p_api_key_id and request_id = p_request_id;
$$;

revoke all on function public.authorize_public_api_request(text,text,text,uuid,text,text)
  from public, anon, authenticated;
grant execute on function public.authorize_public_api_request(text,text,text,uuid,text,text)
  to service_role;
revoke all on function public.complete_public_api_request(uuid,uuid,integer,integer)
  from public, anon, authenticated;
grant execute on function public.complete_public_api_request(uuid,uuid,integer,integer)
  to service_role;

comment on table public.public_api_keys is
  'Hashed tenant API keys. Raw credentials are returned once and never persisted.';
comment on table public.public_api_idempotency is
  'Durable response ledger for future mutating /api/v1 operations.';
comment on function public.authorize_public_api_request is
  'Service-only API key, scope, company and per-minute rate-limit check.';
