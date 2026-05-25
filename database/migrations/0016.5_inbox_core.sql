-- biz.os unified inbox core.
-- Apply manually in Supabase SQL Editor. Do not run automatically.
-- This phase creates simulated/manual channels, conversations, messages and events only.

create table public.inbox_canales (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  canal text not null,
  proveedor text not null default 'manual',
  nombre text not null,
  identificador_externo text,
  estado text not null default 'activo',
  configuracion_publica jsonb not null default '{}'::jsonb,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint inbox_canales_canal_check
    check (canal in ('whatsapp', 'facebook', 'instagram', 'manual')),
  constraint inbox_canales_proveedor_check
    check (proveedor in ('manual', 'meta')),
  constraint inbox_canales_estado_check
    check (estado in ('activo', 'inactivo', 'pendiente', 'error')),
  constraint inbox_canales_id_empresa_unique unique (id, empresa_id),
  constraint inbox_canales_created_by_empresa_fkey
    foreign key (created_by, empresa_id)
    references public.profiles(id, empresa_id)
    on delete set null (created_by),
  constraint inbox_canales_updated_by_empresa_fkey
    foreign key (updated_by, empresa_id)
    references public.profiles(id, empresa_id)
    on delete set null (updated_by)
);

create unique index inbox_canales_empresa_canal_identificador_unique
  on public.inbox_canales (empresa_id, canal, identificador_externo)
  where identificador_externo is not null;
create index inbox_canales_empresa_id_idx on public.inbox_canales (empresa_id);
create index inbox_canales_empresa_canal_idx on public.inbox_canales (empresa_id, canal);
create index inbox_canales_empresa_estado_idx on public.inbox_canales (empresa_id, estado);
create index inbox_canales_empresa_proveedor_idx on public.inbox_canales (empresa_id, proveedor);

create trigger set_inbox_canales_updated_at
before update on public.inbox_canales
for each row execute function public.set_updated_at();

create table public.inbox_conversaciones (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  canal_id uuid,
  cliente_id uuid,
  asignado_a uuid,
  canal text not null,
  contacto_nombre text,
  contacto_identificador text,
  contacto_telefono text,
  contacto_usuario text,
  estado text not null default 'abierta',
  prioridad text not null default 'normal',
  ultimo_mensaje text,
  ultimo_mensaje_at timestamptz,
  cerrada_at timestamptz,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint inbox_conversaciones_canal_check
    check (canal in ('whatsapp', 'facebook', 'instagram', 'manual')),
  constraint inbox_conversaciones_estado_check
    check (estado in ('abierta', 'pendiente', 'cerrada', 'spam')),
  constraint inbox_conversaciones_prioridad_check
    check (prioridad in ('baja', 'normal', 'alta', 'urgente')),
  constraint inbox_conversaciones_id_empresa_unique unique (id, empresa_id),
  constraint inbox_conversaciones_canal_empresa_fkey
    foreign key (canal_id, empresa_id)
    references public.inbox_canales(id, empresa_id)
    on delete set null (canal_id),
  constraint inbox_conversaciones_cliente_empresa_fkey
    foreign key (cliente_id, empresa_id)
    references public.crm_clientes(id, empresa_id)
    on delete set null (cliente_id),
  constraint inbox_conversaciones_asignado_empresa_fkey
    foreign key (asignado_a, empresa_id)
    references public.profiles(id, empresa_id)
    on delete set null (asignado_a),
  constraint inbox_conversaciones_created_by_empresa_fkey
    foreign key (created_by, empresa_id)
    references public.profiles(id, empresa_id)
    on delete set null (created_by),
  constraint inbox_conversaciones_updated_by_empresa_fkey
    foreign key (updated_by, empresa_id)
    references public.profiles(id, empresa_id)
    on delete set null (updated_by)
);

create index inbox_conversaciones_empresa_id_idx on public.inbox_conversaciones (empresa_id);
create index inbox_conversaciones_empresa_estado_idx on public.inbox_conversaciones (empresa_id, estado);
create index inbox_conversaciones_empresa_canal_idx on public.inbox_conversaciones (empresa_id, canal);
create index inbox_conversaciones_empresa_cliente_idx on public.inbox_conversaciones (empresa_id, cliente_id);
create index inbox_conversaciones_empresa_asignado_idx on public.inbox_conversaciones (empresa_id, asignado_a);
create index inbox_conversaciones_empresa_ultimo_mensaje_at_idx on public.inbox_conversaciones (empresa_id, ultimo_mensaje_at);
create index inbox_conversaciones_empresa_created_at_idx on public.inbox_conversaciones (empresa_id, created_at);

create trigger set_inbox_conversaciones_updated_at
before update on public.inbox_conversaciones
for each row execute function public.set_updated_at();

create table public.inbox_mensajes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  conversacion_id uuid not null,
  direccion text not null,
  tipo text not null default 'texto',
  contenido text,
  estado text not null default 'registrado',
  canal_message_id text,
  es_nota_interna boolean not null default false,
  enviado_por uuid,
  received_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now(),

  constraint inbox_mensajes_direccion_check
    check (direccion in ('entrante', 'saliente', 'interna')),
  constraint inbox_mensajes_tipo_check
    check (tipo in ('texto', 'imagen', 'audio', 'video', 'documento', 'sistema')),
  constraint inbox_mensajes_estado_check
    check (estado in ('registrado', 'enviado', 'entregado', 'leido', 'fallido')),
  constraint inbox_mensajes_conversacion_empresa_fkey
    foreign key (conversacion_id, empresa_id)
    references public.inbox_conversaciones(id, empresa_id)
    on delete cascade,
  constraint inbox_mensajes_enviado_por_empresa_fkey
    foreign key (enviado_por, empresa_id)
    references public.profiles(id, empresa_id)
    on delete set null (enviado_por)
);

create index inbox_mensajes_empresa_id_idx on public.inbox_mensajes (empresa_id);
create index inbox_mensajes_empresa_conversacion_idx on public.inbox_mensajes (empresa_id, conversacion_id);
create index inbox_mensajes_empresa_direccion_idx on public.inbox_mensajes (empresa_id, direccion);
create index inbox_mensajes_empresa_created_at_idx on public.inbox_mensajes (empresa_id, created_at);
create index inbox_mensajes_empresa_canal_message_id_idx on public.inbox_mensajes (empresa_id, canal_message_id);

create table public.inbox_eventos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  conversacion_id uuid,
  tipo text not null,
  descripcion text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now(),

  constraint inbox_eventos_conversacion_empresa_fkey
    foreign key (conversacion_id, empresa_id)
    references public.inbox_conversaciones(id, empresa_id)
    on delete cascade,
  constraint inbox_eventos_created_by_empresa_fkey
    foreign key (created_by, empresa_id)
    references public.profiles(id, empresa_id)
    on delete set null (created_by)
);

create index inbox_eventos_empresa_id_idx on public.inbox_eventos (empresa_id);
create index inbox_eventos_empresa_conversacion_idx on public.inbox_eventos (empresa_id, conversacion_id);
create index inbox_eventos_empresa_tipo_idx on public.inbox_eventos (empresa_id, tipo);
create index inbox_eventos_empresa_created_at_idx on public.inbox_eventos (empresa_id, created_at);

insert into public.permisos (codigo, nombre, descripcion, modulo_codigo, estado)
values
  ('inbox.conversations.view', 'Ver conversaciones de inbox', 'Permite consultar conversaciones y mensajes del inbox.', null, 'activo'),
  ('inbox.conversations.create', 'Crear conversaciones de inbox', 'Permite crear conversaciones manuales y registrar mensajes entrantes simulados.', null, 'activo'),
  ('inbox.conversations.reply', 'Responder conversaciones de inbox', 'Permite registrar respuestas salientes simuladas y notas internas.', null, 'activo'),
  ('inbox.conversations.assign', 'Asignar conversaciones de inbox', 'Permite asignar conversaciones y vincularlas con clientes CRM.', null, 'activo'),
  ('inbox.conversations.status.change', 'Cambiar estado de conversaciones de inbox', 'Permite cambiar estados de conversaciones.', null, 'activo'),
  ('inbox.channels.view', 'Ver canales de inbox', 'Permite consultar canales configurados.', null, 'activo'),
  ('inbox.channels.manage', 'Gestionar canales de inbox', 'Permite crear y cambiar estado de canales manuales.', null, 'activo')
on conflict (codigo) do update
set nombre = excluded.nombre,
    descripcion = excluded.descripcion,
    modulo_codigo = excluded.modulo_codigo,
    estado = excluded.estado;

insert into public.rol_permisos (empresa_id, rol_id, permiso_id)
select r.empresa_id, r.id, p.id
from public.roles as r
join public.permisos as p
  on p.codigo in (
    'inbox.conversations.view',
    'inbox.conversations.create',
    'inbox.conversations.reply',
    'inbox.conversations.assign',
    'inbox.conversations.status.change',
    'inbox.channels.view',
    'inbox.channels.manage'
  )
where r.es_sistema = true
  and r.nombre = 'Administrador'
on conflict on constraint rol_permisos_empresa_rol_permiso_unique
do nothing;

alter table public.inbox_canales enable row level security;
alter table public.inbox_conversaciones enable row level security;
alter table public.inbox_mensajes enable row level security;
alter table public.inbox_eventos enable row level security;

grant select on public.inbox_canales to authenticated;
grant select on public.inbox_conversaciones to authenticated;
grant select on public.inbox_mensajes to authenticated;
grant select on public.inbox_eventos to authenticated;

create policy inbox_canales_select_permission
on public.inbox_canales
for select
to authenticated
using (
  empresa_id = public.current_empresa_id()
  and (
    public.current_user_has_permission('inbox.channels.view')
    or public.current_user_has_permission('inbox.channels.manage')
  )
);

create policy inbox_conversaciones_select_permission
on public.inbox_conversaciones
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

create policy inbox_mensajes_select_permission
on public.inbox_mensajes
for select
to authenticated
using (
  empresa_id = public.current_empresa_id()
  and (
    public.current_user_has_permission('inbox.conversations.view')
    or public.current_user_has_permission('inbox.conversations.reply')
  )
);

create policy inbox_eventos_select_permission
on public.inbox_eventos
for select
to authenticated
using (
  empresa_id = public.current_empresa_id()
  and public.current_user_has_permission('inbox.conversations.view')
);

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

  if p_canal not in ('whatsapp', 'facebook', 'instagram', 'manual') then
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
    'manual',
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

create or replace function public.cambiar_estado_inbox_canal(
  p_canal_id uuid,
  p_estado text
)
returns setof public.inbox_canales
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_empresa_id uuid := public.current_empresa_id();
  v_antes public.inbox_canales%rowtype;
  v_despues public.inbox_canales%rowtype;
begin
  if v_user_id is null or v_empresa_id is null then
    raise exception 'Usuario autenticado requerido.' using errcode = '28000';
  end if;

  if not public.current_user_has_permission('inbox.channels.manage') then
    raise exception 'Permiso inbox.channels.manage requerido.' using errcode = '42501';
  end if;

  if p_estado not in ('activo', 'inactivo', 'pendiente', 'error') then
    raise exception 'Estado de canal invalido.' using errcode = '22023';
  end if;

  select c.* into v_antes
  from public.inbox_canales as c
  where c.id = p_canal_id
    and c.empresa_id = v_empresa_id;

  if v_antes.id is null then
    raise exception 'Canal no encontrado.' using errcode = '02000';
  end if;

  update public.inbox_canales as c
  set estado = p_estado,
      updated_by = v_user_id
  where c.id = p_canal_id
    and c.empresa_id = v_empresa_id
  returning c.* into v_despues;

  insert into public.auditoria_eventos (
    empresa_id,
    usuario_id,
    entidad,
    entidad_id,
    accion,
    datos_antes,
    datos_despues
  )
  values (
    v_empresa_id,
    v_user_id,
    'inbox_canales',
    p_canal_id,
    'cambiar_estado_inbox_canal',
    to_jsonb(v_antes),
    to_jsonb(v_despues)
  );

  return next v_despues;
end;
$$;

create or replace function public.crear_inbox_conversacion_manual(
  p_canal_id uuid default null,
  p_canal text default 'manual',
  p_cliente_id uuid default null,
  p_contacto_nombre text default null,
  p_contacto_identificador text default null,
  p_contacto_telefono text default null,
  p_contacto_usuario text default null,
  p_asignado_a uuid default null,
  p_mensaje_inicial text default null
)
returns setof public.inbox_conversaciones
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_empresa_id uuid := public.current_empresa_id();
  v_canal text := p_canal;
  v_conversacion public.inbox_conversaciones%rowtype;
  v_mensaje public.inbox_mensajes%rowtype;
begin
  if v_user_id is null or v_empresa_id is null then
    raise exception 'Usuario autenticado requerido.' using errcode = '28000';
  end if;

  if not public.current_user_has_permission('inbox.conversations.create') then
    raise exception 'Permiso inbox.conversations.create requerido.' using errcode = '42501';
  end if;

  if p_canal_id is not null then
    select c.canal into v_canal
    from public.inbox_canales as c
    where c.id = p_canal_id
      and c.empresa_id = v_empresa_id;

    if v_canal is null then
      raise exception 'Canal no encontrado.' using errcode = '02000';
    end if;
  end if;

  if v_canal not in ('whatsapp', 'facebook', 'instagram', 'manual') then
    raise exception 'Canal de conversacion invalido.' using errcode = '22023';
  end if;

  if p_cliente_id is not null and not exists (
    select 1
    from public.crm_clientes as cc
    where cc.id = p_cliente_id
      and cc.empresa_id = v_empresa_id
  ) then
    raise exception 'Cliente CRM no encontrado.' using errcode = '02000';
  end if;

  if p_asignado_a is not null and not exists (
    select 1
    from public.profiles as pr
    where pr.id = p_asignado_a
      and pr.empresa_id = v_empresa_id
      and pr.estado = 'activo'
  ) then
    raise exception 'Usuario asignado no disponible.' using errcode = '02000';
  end if;

  insert into public.inbox_conversaciones (
    empresa_id,
    canal_id,
    cliente_id,
    asignado_a,
    canal,
    contacto_nombre,
    contacto_identificador,
    contacto_telefono,
    contacto_usuario,
    estado,
    prioridad,
    created_by,
    updated_by
  )
  values (
    v_empresa_id,
    p_canal_id,
    p_cliente_id,
    p_asignado_a,
    v_canal,
    nullif(btrim(coalesce(p_contacto_nombre, '')), ''),
    nullif(btrim(coalesce(p_contacto_identificador, '')), ''),
    nullif(btrim(coalesce(p_contacto_telefono, '')), ''),
    nullif(btrim(coalesce(p_contacto_usuario, '')), ''),
    'abierta',
    'normal',
    v_user_id,
    v_user_id
  )
  returning * into v_conversacion;

  if nullif(btrim(coalesce(p_mensaje_inicial, '')), '') is not null then
    insert into public.inbox_mensajes (
      empresa_id,
      conversacion_id,
      direccion,
      tipo,
      contenido,
      estado,
      es_nota_interna,
      enviado_por,
      received_at
    )
    values (
      v_empresa_id,
      v_conversacion.id,
      'entrante',
      'texto',
      btrim(p_mensaje_inicial),
      'registrado',
      false,
      v_user_id,
      now()
    )
    returning * into v_mensaje;

    update public.inbox_conversaciones as ic
    set ultimo_mensaje = v_mensaje.contenido,
        ultimo_mensaje_at = v_mensaje.created_at,
        updated_by = v_user_id
    where ic.id = v_conversacion.id
      and ic.empresa_id = v_empresa_id
    returning ic.* into v_conversacion;
  end if;

  insert into public.inbox_eventos (
    empresa_id,
    conversacion_id,
    tipo,
    descripcion,
    created_by
  )
  values (
    v_empresa_id,
    v_conversacion.id,
    'conversacion_creada',
    'Conversacion manual creada.',
    v_user_id
  );

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
    'inbox_conversaciones',
    v_conversacion.id,
    'crear_inbox_conversacion_manual',
    to_jsonb(v_conversacion)
  );

  return next v_conversacion;
end;
$$;

create or replace function public.agregar_mensaje_inbox(
  p_conversacion_id uuid,
  p_direccion text,
  p_contenido text,
  p_es_nota_interna boolean default false
)
returns setof public.inbox_mensajes
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_empresa_id uuid := public.current_empresa_id();
  v_conversacion public.inbox_conversaciones%rowtype;
  v_mensaje public.inbox_mensajes%rowtype;
begin
  if v_user_id is null or v_empresa_id is null then
    raise exception 'Usuario autenticado requerido.' using errcode = '28000';
  end if;

  if p_direccion not in ('entrante', 'saliente', 'interna') then
    raise exception 'Direccion de mensaje invalida.' using errcode = '22023';
  end if;

  if p_es_nota_interna = true and p_direccion <> 'interna' then
    raise exception 'Las notas internas deben usar direccion interna.' using errcode = '22023';
  end if;

  if p_direccion = 'interna' and p_es_nota_interna = false then
    raise exception 'La direccion interna requiere nota interna.' using errcode = '22023';
  end if;

  if p_direccion = 'saliente'
    and not public.current_user_has_permission('inbox.conversations.reply') then
    raise exception 'Permiso inbox.conversations.reply requerido.' using errcode = '42501';
  end if;

  if p_direccion = 'entrante'
    and not (
      public.current_user_has_permission('inbox.conversations.create')
      or public.current_user_has_permission('inbox.conversations.reply')
    ) then
    raise exception 'Permiso para registrar mensaje entrante requerido.' using errcode = '42501';
  end if;

  if p_direccion = 'interna'
    and not public.current_user_has_permission('inbox.conversations.reply') then
    raise exception 'Permiso inbox.conversations.reply requerido.' using errcode = '42501';
  end if;

  if nullif(btrim(coalesce(p_contenido, '')), '') is null then
    raise exception 'Contenido de mensaje requerido.' using errcode = '22023';
  end if;

  select c.* into v_conversacion
  from public.inbox_conversaciones as c
  where c.id = p_conversacion_id
    and c.empresa_id = v_empresa_id;

  if v_conversacion.id is null then
    raise exception 'Conversacion no encontrada.' using errcode = '02000';
  end if;

  insert into public.inbox_mensajes (
    empresa_id,
    conversacion_id,
    direccion,
    tipo,
    contenido,
    estado,
    es_nota_interna,
    enviado_por,
    received_at,
    sent_at
  )
  values (
    v_empresa_id,
    p_conversacion_id,
    p_direccion,
    'texto',
    btrim(p_contenido),
    case when p_direccion = 'saliente' then 'enviado' else 'registrado' end,
    p_es_nota_interna,
    v_user_id,
    case when p_direccion = 'entrante' then now() else null end,
    case when p_direccion = 'saliente' then now() else null end
  )
  returning * into v_mensaje;

  if p_es_nota_interna = false then
    update public.inbox_conversaciones as c
    set ultimo_mensaje = v_mensaje.contenido,
        ultimo_mensaje_at = v_mensaje.created_at,
        updated_by = v_user_id
    where c.id = p_conversacion_id
      and c.empresa_id = v_empresa_id;
  end if;

  insert into public.inbox_eventos (
    empresa_id,
    conversacion_id,
    tipo,
    descripcion,
    metadata,
    created_by
  )
  values (
    v_empresa_id,
    p_conversacion_id,
    case when p_es_nota_interna then 'nota_interna' else 'mensaje_' || p_direccion end,
    case when p_es_nota_interna then 'Nota interna agregada.' else 'Mensaje simulado registrado.' end,
    jsonb_build_object('mensaje_id', v_mensaje.id, 'direccion', p_direccion),
    v_user_id
  );

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
    'inbox_mensajes',
    v_mensaje.id,
    'agregar_mensaje_inbox',
    to_jsonb(v_mensaje)
  );

  return next v_mensaje;
end;
$$;

create or replace function public.asignar_inbox_conversacion(
  p_conversacion_id uuid,
  p_asignado_a uuid default null
)
returns setof public.inbox_conversaciones
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_empresa_id uuid := public.current_empresa_id();
  v_antes public.inbox_conversaciones%rowtype;
  v_despues public.inbox_conversaciones%rowtype;
begin
  if v_user_id is null or v_empresa_id is null then
    raise exception 'Usuario autenticado requerido.' using errcode = '28000';
  end if;

  if not public.current_user_has_permission('inbox.conversations.assign') then
    raise exception 'Permiso inbox.conversations.assign requerido.' using errcode = '42501';
  end if;

  select c.* into v_antes
  from public.inbox_conversaciones as c
  where c.id = p_conversacion_id
    and c.empresa_id = v_empresa_id;

  if v_antes.id is null then
    raise exception 'Conversacion no encontrada.' using errcode = '02000';
  end if;

  if p_asignado_a is not null and not exists (
    select 1
    from public.profiles as pr
    where pr.id = p_asignado_a
      and pr.empresa_id = v_empresa_id
      and pr.estado = 'activo'
  ) then
    raise exception 'Usuario asignado no disponible.' using errcode = '02000';
  end if;

  update public.inbox_conversaciones as c
  set asignado_a = p_asignado_a,
      updated_by = v_user_id
  where c.id = p_conversacion_id
    and c.empresa_id = v_empresa_id
  returning c.* into v_despues;

  insert into public.inbox_eventos (
    empresa_id,
    conversacion_id,
    tipo,
    descripcion,
    metadata,
    created_by
  )
  values (
    v_empresa_id,
    p_conversacion_id,
    'asignacion',
    'Asignacion de conversacion actualizada.',
    jsonb_build_object('asignado_a', p_asignado_a),
    v_user_id
  );

  insert into public.auditoria_eventos (
    empresa_id,
    usuario_id,
    entidad,
    entidad_id,
    accion,
    datos_antes,
    datos_despues
  )
  values (
    v_empresa_id,
    v_user_id,
    'inbox_conversaciones',
    p_conversacion_id,
    'asignar_inbox_conversacion',
    to_jsonb(v_antes),
    to_jsonb(v_despues)
  );

  return next v_despues;
end;
$$;

create or replace function public.vincular_inbox_conversacion_cliente(
  p_conversacion_id uuid,
  p_cliente_id uuid
)
returns setof public.inbox_conversaciones
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_empresa_id uuid := public.current_empresa_id();
  v_antes public.inbox_conversaciones%rowtype;
  v_despues public.inbox_conversaciones%rowtype;
begin
  if v_user_id is null or v_empresa_id is null then
    raise exception 'Usuario autenticado requerido.' using errcode = '28000';
  end if;

  if not (
    public.current_user_has_permission('inbox.conversations.assign')
    or public.current_user_has_permission('inbox.conversations.create')
  ) then
    raise exception 'Permiso para vincular cliente requerido.' using errcode = '42501';
  end if;

  select c.* into v_antes
  from public.inbox_conversaciones as c
  where c.id = p_conversacion_id
    and c.empresa_id = v_empresa_id;

  if v_antes.id is null then
    raise exception 'Conversacion no encontrada.' using errcode = '02000';
  end if;

  if not exists (
    select 1
    from public.crm_clientes as cc
    where cc.id = p_cliente_id
      and cc.empresa_id = v_empresa_id
  ) then
    raise exception 'Cliente CRM no encontrado.' using errcode = '02000';
  end if;

  update public.inbox_conversaciones as c
  set cliente_id = p_cliente_id,
      updated_by = v_user_id
  where c.id = p_conversacion_id
    and c.empresa_id = v_empresa_id
  returning c.* into v_despues;

  insert into public.inbox_eventos (
    empresa_id,
    conversacion_id,
    tipo,
    descripcion,
    metadata,
    created_by
  )
  values (
    v_empresa_id,
    p_conversacion_id,
    'cliente_vinculado',
    'Cliente CRM vinculado a la conversacion.',
    jsonb_build_object('cliente_id', p_cliente_id),
    v_user_id
  );

  insert into public.auditoria_eventos (
    empresa_id,
    usuario_id,
    entidad,
    entidad_id,
    accion,
    datos_antes,
    datos_despues
  )
  values (
    v_empresa_id,
    v_user_id,
    'inbox_conversaciones',
    p_conversacion_id,
    'vincular_inbox_conversacion_cliente',
    to_jsonb(v_antes),
    to_jsonb(v_despues)
  );

  return next v_despues;
end;
$$;

create or replace function public.cambiar_estado_inbox_conversacion(
  p_conversacion_id uuid,
  p_estado text
)
returns setof public.inbox_conversaciones
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_empresa_id uuid := public.current_empresa_id();
  v_antes public.inbox_conversaciones%rowtype;
  v_despues public.inbox_conversaciones%rowtype;
begin
  if v_user_id is null or v_empresa_id is null then
    raise exception 'Usuario autenticado requerido.' using errcode = '28000';
  end if;

  if not public.current_user_has_permission('inbox.conversations.status.change') then
    raise exception 'Permiso inbox.conversations.status.change requerido.' using errcode = '42501';
  end if;

  if p_estado not in ('abierta', 'pendiente', 'cerrada', 'spam') then
    raise exception 'Estado de conversacion invalido.' using errcode = '22023';
  end if;

  select c.* into v_antes
  from public.inbox_conversaciones as c
  where c.id = p_conversacion_id
    and c.empresa_id = v_empresa_id;

  if v_antes.id is null then
    raise exception 'Conversacion no encontrada.' using errcode = '02000';
  end if;

  update public.inbox_conversaciones as c
  set estado = p_estado,
      cerrada_at = case when p_estado = 'cerrada' then now() else null end,
      updated_by = v_user_id
  where c.id = p_conversacion_id
    and c.empresa_id = v_empresa_id
  returning c.* into v_despues;

  insert into public.inbox_eventos (
    empresa_id,
    conversacion_id,
    tipo,
    descripcion,
    metadata,
    created_by
  )
  values (
    v_empresa_id,
    p_conversacion_id,
    'estado',
    'Estado de conversacion actualizado.',
    jsonb_build_object('estado_anterior', v_antes.estado, 'estado_nuevo', p_estado),
    v_user_id
  );

  insert into public.auditoria_eventos (
    empresa_id,
    usuario_id,
    entidad,
    entidad_id,
    accion,
    datos_antes,
    datos_despues
  )
  values (
    v_empresa_id,
    v_user_id,
    'inbox_conversaciones',
    p_conversacion_id,
    'cambiar_estado_inbox_conversacion',
    to_jsonb(v_antes),
    to_jsonb(v_despues)
  );

  return next v_despues;
end;
$$;

revoke all on function public.crear_inbox_canal_manual(text, text, text) from public;
revoke all on function public.cambiar_estado_inbox_canal(uuid, text) from public;
revoke all on function public.crear_inbox_conversacion_manual(uuid, text, uuid, text, text, text, text, uuid, text) from public;
revoke all on function public.agregar_mensaje_inbox(uuid, text, text, boolean) from public;
revoke all on function public.asignar_inbox_conversacion(uuid, uuid) from public;
revoke all on function public.vincular_inbox_conversacion_cliente(uuid, uuid) from public;
revoke all on function public.cambiar_estado_inbox_conversacion(uuid, text) from public;

grant execute on function public.crear_inbox_canal_manual(text, text, text) to authenticated;
grant execute on function public.cambiar_estado_inbox_canal(uuid, text) to authenticated;
grant execute on function public.crear_inbox_conversacion_manual(uuid, text, uuid, text, text, text, text, uuid, text) to authenticated;
grant execute on function public.agregar_mensaje_inbox(uuid, text, text, boolean) to authenticated;
grant execute on function public.asignar_inbox_conversacion(uuid, uuid) to authenticated;
grant execute on function public.vincular_inbox_conversacion_cliente(uuid, uuid) to authenticated;
grant execute on function public.cambiar_estado_inbox_conversacion(uuid, text) to authenticated;
