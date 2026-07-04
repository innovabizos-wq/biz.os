-- Whapp Omnicanal base: allow email as a first-class Inbox channel.

alter table public.inbox_canales
  drop constraint if exists inbox_canales_canal_check;

alter table public.inbox_canales
  add constraint inbox_canales_canal_check
  check (canal in ('whatsapp', 'facebook', 'instagram', 'email', 'manual'));

alter table public.inbox_conversaciones
  drop constraint if exists inbox_conversaciones_canal_check;

alter table public.inbox_conversaciones
  add constraint inbox_conversaciones_canal_check
  check (canal in ('whatsapp', 'facebook', 'instagram', 'email', 'manual'));

alter table public.inbox_canales
  drop constraint if exists inbox_canales_proveedor_check;

alter table public.inbox_canales
  add constraint inbox_canales_proveedor_check
  check (proveedor in ('manual', 'meta', 'email'));

create index if not exists inbox_conversaciones_empresa_canal_estado_idx
  on public.inbox_conversaciones (empresa_id, canal, estado);

create index if not exists inbox_mensajes_empresa_conversacion_direccion_created_idx
  on public.inbox_mensajes (empresa_id, conversacion_id, direccion, created_at desc);

create table if not exists public.inbox_conversacion_lecturas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  conversacion_id uuid not null,
  profile_id uuid not null,
  read_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inbox_conversacion_lecturas_conversacion_empresa_fkey
    foreign key (conversacion_id, empresa_id)
    references public.inbox_conversaciones(id, empresa_id)
    on delete cascade,
  constraint inbox_conversacion_lecturas_profile_empresa_fkey
    foreign key (profile_id, empresa_id)
    references public.profiles(id, empresa_id)
    on delete cascade,
  constraint inbox_conversacion_lecturas_empresa_conversation_profile_unique
    unique (empresa_id, conversacion_id, profile_id)
);

create index if not exists inbox_conversacion_lecturas_empresa_profile_idx
  on public.inbox_conversacion_lecturas (empresa_id, profile_id);

create index if not exists inbox_conversacion_lecturas_empresa_conversacion_idx
  on public.inbox_conversacion_lecturas (empresa_id, conversacion_id);

drop trigger if exists set_inbox_conversacion_lecturas_updated_at
on public.inbox_conversacion_lecturas;

create trigger set_inbox_conversacion_lecturas_updated_at
before update on public.inbox_conversacion_lecturas
for each row execute function public.set_updated_at();

alter table public.inbox_conversacion_lecturas enable row level security;

grant select, insert, update on public.inbox_conversacion_lecturas to authenticated;

drop policy if exists inbox_conversacion_lecturas_select_permission
on public.inbox_conversacion_lecturas;

create policy inbox_conversacion_lecturas_select_permission
on public.inbox_conversacion_lecturas
for select
to authenticated
using (
  empresa_id = public.current_empresa_id()
  and (
    public.current_user_has_permission('inbox.conversations.view')
    or public.current_user_has_permission('inbox.conversations.reply')
    or public.current_user_has_permission('inbox.conversations.assign')
  )
);

create or replace function public.marcar_inbox_conversacion_leida(
  p_conversacion_id uuid
)
returns setof public.inbox_conversacion_lecturas
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_empresa_id uuid := public.current_empresa_id();
  v_conversacion public.inbox_conversaciones%rowtype;
  v_lectura public.inbox_conversacion_lecturas%rowtype;
begin
  if v_user_id is null or v_empresa_id is null then
    raise exception 'Usuario autenticado requerido.' using errcode = '28000';
  end if;

  if not (
    public.current_user_has_permission('inbox.conversations.view')
    or public.current_user_has_permission('inbox.conversations.reply')
    or public.current_user_has_permission('inbox.conversations.assign')
  ) then
    raise exception 'Permiso para leer conversaciones requerido.' using errcode = '42501';
  end if;

  select * into v_conversacion
  from public.inbox_conversaciones
  where id = p_conversacion_id
    and empresa_id = v_empresa_id;

  if v_conversacion.id is null then
    raise exception 'Conversacion no encontrada.' using errcode = '02000';
  end if;

  insert into public.inbox_conversacion_lecturas (
    empresa_id,
    conversacion_id,
    profile_id,
    read_at
  )
  values (
    v_empresa_id,
    p_conversacion_id,
    v_user_id,
    now()
  )
  on conflict on constraint inbox_conversacion_lecturas_empresa_conversation_profile_unique
  do update set
    read_at = excluded.read_at,
    updated_at = now()
  returning * into v_lectura;

  return next v_lectura;
end;
$$;

revoke all on function public.marcar_inbox_conversacion_leida(uuid) from public;
grant execute on function public.marcar_inbox_conversacion_leida(uuid) to authenticated;

create or replace function public.crear_inbox_canal_manual(
  p_canal text,
  p_nombre text,
  p_identificador_externo text default null
)
returns setof public.inbox_canales
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_empresa_id uuid := public.current_empresa_id();
  v_canal public.inbox_canales%rowtype;
begin
  if v_user_id is null or v_empresa_id is null then
    raise exception 'Usuario autenticado requerido.' using errcode = '28000';
  end if;

  if not public.current_user_has_permission('inbox.channels.manage') then
    raise exception 'Permiso inbox.channels.manage requerido.' using errcode = '42501';
  end if;

  if p_canal not in ('whatsapp', 'facebook', 'instagram', 'email', 'manual') then
    raise exception 'Canal de inbox invalido.' using errcode = '22023';
  end if;

  if nullif(btrim(p_nombre), '') is null then
    raise exception 'Nombre de canal requerido.' using errcode = '22023';
  end if;

  insert into public.inbox_canales (
    empresa_id,
    canal,
    proveedor,
    nombre,
    identificador_externo,
    estado,
    created_by,
    updated_by
  )
  values (
    v_empresa_id,
    p_canal,
    case when p_canal = 'email' then 'email' else 'manual' end,
    btrim(p_nombre),
    nullif(btrim(coalesce(p_identificador_externo, '')), ''),
    'activo',
    v_user_id,
    v_user_id
  )
  returning * into v_canal;

  insert into public.auditoria_eventos (
    empresa_id,
    usuario_id,
    entidad,
    entidad_id,
    accion,
    datos_despues
  )
  values (
    v_empresa_id,
    v_user_id,
    'inbox_canales',
    v_canal.id,
    'crear_inbox_canal_manual',
    to_jsonb(v_canal)
  );

  return next v_canal;
end;
$$;
