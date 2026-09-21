-- Fix ambiguous unnest alias inside initial tenant bootstrap.

create or replace function public.bootstrap_empresa_inicial(
  p_nombre_empresa text,
  p_nombre_comercial text,
  p_identificacion_fiscal text,
  p_correo_empresa text,
  p_telefono_empresa text,
  p_nombre_usuario text,
  p_correo_usuario text,
  p_telefono_usuario text
)
returns table (
  empresa_id uuid,
  profile_id uuid,
  sucursal_id uuid,
  rol_id uuid,
  plan_codigo text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_jwt_email text := nullif(auth.jwt() ->> 'email', '');
  v_empresa_id uuid;
  v_sucursal_id uuid;
  v_rol_id uuid;
  v_plan_id uuid;
begin
  if v_user_id is null then
    raise exception 'Usuario autenticado requerido.'
      using errcode = '28000';
  end if;

  if exists (
    select 1
    from public.profiles as p
    where p.id = v_user_id
  ) then
    raise exception 'El usuario ya tiene empresa/profile.'
      using errcode = '23505';
  end if;

  if nullif(trim(p_nombre_empresa), '') is null then
    raise exception 'El nombre de empresa es requerido.'
      using errcode = '22023';
  end if;

  if nullif(trim(p_nombre_usuario), '') is null then
    raise exception 'El nombre del usuario es requerido.'
      using errcode = '22023';
  end if;

  if nullif(trim(p_correo_usuario), '') is null then
    raise exception 'El correo del usuario es requerido.'
      using errcode = '22023';
  end if;

  if v_jwt_email is not null
    and lower(trim(p_correo_usuario)) <> lower(trim(v_jwt_email)) then
    raise exception 'El correo del usuario no coincide con la sesion.'
      using errcode = '28000';
  end if;

  insert into public.empresas (nombre, nombre_comercial, identificacion_fiscal, correo, telefono)
  values (
    trim(p_nombre_empresa),
    nullif(trim(p_nombre_comercial), ''),
    nullif(trim(p_identificacion_fiscal), ''),
    nullif(trim(p_correo_empresa), ''),
    nullif(trim(p_telefono_empresa), '')
  )
  returning id into v_empresa_id;

  insert into public.sucursales (empresa_id, nombre, codigo)
  values (v_empresa_id, 'Sucursal Principal', 'principal')
  returning id into v_sucursal_id;

  with standard_roles(nombre, descripcion, es_sistema) as (
    values
      ('Super Admin', 'Acceso total a la empresa y configuracion del sistema.', true),
      ('Administrador', 'Administracion operativa de la empresa.', true),
      ('Supervisor', 'Supervision de operacion, equipo y reportes.', false),
      ('Vendedor', 'Gestion comercial, clientes, cotizaciones, ventas y conversaciones.', false),
      ('Servicio al cliente', 'Atencion de clientes, conversaciones, seguimiento y agenda.', false),
      ('Bodeguero', 'Gestion de inventario, bodega y preparacion de pedidos.', false),
      ('Chofer / Repartidor', 'Gestion de entregas, rutas asignadas y ubicacion para despacho.', false),
      ('Contabilidad / Facturacion', 'Gestion de facturacion, ventas administrativas y reportes financieros.', false),
      ('RRHH', 'Gestion de personal, colaboradores e informacion interna.', false)
  )
  insert into public.roles (empresa_id, nombre, descripcion, es_sistema)
  select v_empresa_id, sr.nombre, sr.descripcion, sr.es_sistema
  from standard_roles as sr;

  select r.id
  into v_rol_id
  from public.roles as r
  where r.empresa_id = v_empresa_id
    and r.nombre = 'Super Admin'
  limit 1;

  insert into public.rol_permisos (empresa_id, rol_id, permiso_id)
  select v_empresa_id, v_rol_id, p.id
  from public.permisos as p
  where p.estado = 'activo';

  with role_permissions(nombre, codigos) as (
    values
      ('Administrador', array['admin.users.view','admin.users.manage','admin.roles.view','admin.settings.view','reports.dashboard.view','crm.customers.view','crm.customers.create','crm.customers.edit','crm.interactions.view','crm.interactions.create','crm.followups.view','crm.followups.create','crm.followups.edit','quotes.view','quotes.create','quotes.edit','quotes.status.change','catalog.products.view','catalog.categories.view','sales.orders.view','sales.orders.create','sales.orders.edit','sales.orders.status.change','inventory.products.view','inventory.stock.view','inventory.movements.view','inventory.warehouses.view','dispatch.orders.view','dispatch.orders.create','dispatch.orders.edit','dispatch.orders.status.change','inbox.conversations.view','inbox.conversations.create','inbox.conversations.reply','inbox.conversations.assign','inbox.conversations.status.change','inbox.channels.view','hr.timesheets.view','hr.timesheets.dashboard']::text[]),
      ('Supervisor', array['admin.users.view','admin.roles.view','reports.dashboard.view','crm.customers.view','crm.interactions.view','crm.followups.view','crm.followups.edit','quotes.view','sales.orders.view','inventory.products.view','inventory.stock.view','inventory.movements.view','inventory.warehouses.view','dispatch.orders.view','inbox.conversations.view','inbox.conversations.assign','hr.timesheets.view','hr.timesheets.dashboard']::text[]),
      ('Vendedor', array['crm.customers.view','crm.customers.create','crm.customers.edit','crm.interactions.view','crm.interactions.create','crm.followups.view','crm.followups.create','crm.followups.edit','quotes.view','quotes.create','quotes.edit','quotes.status.change','sales.orders.view','sales.orders.create','catalog.products.view','catalog.categories.view','inbox.conversations.view','inbox.conversations.create','inbox.conversations.reply']::text[]),
      ('Servicio al cliente', array['crm.customers.view','crm.customers.edit','crm.interactions.view','crm.interactions.create','crm.followups.view','crm.followups.create','crm.followups.edit','inbox.conversations.view','inbox.conversations.create','inbox.conversations.reply','inbox.conversations.assign','inbox.conversations.status.change']::text[]),
      ('Bodeguero', array['catalog.products.view','catalog.categories.view','inventory.products.view','inventory.stock.view','inventory.stock.adjust','inventory.movements.view','inventory.warehouses.view','dispatch.orders.view']::text[]),
      ('Chofer / Repartidor', array['dispatch.orders.view','dispatch.orders.status.change','driver.tracking.use']::text[]),
      ('Contabilidad / Facturacion', array['crm.customers.view','quotes.view','sales.orders.view','sales.orders.edit','reports.dashboard.view']::text[]),
      ('RRHH', array['admin.users.view','admin.users.manage','admin.roles.view','hr.timesheets.view','hr.timesheets.manage','hr.timesheets.dashboard','hr.timesheets.states.manage','reports.dashboard.view']::text[])
  )
  insert into public.rol_permisos (empresa_id, rol_id, permiso_id)
  select v_empresa_id, r.id, p.id
  from role_permissions as rp
  join public.roles as r
    on r.empresa_id = v_empresa_id
    and r.nombre = rp.nombre
  join lateral unnest(rp.codigos) as permiso_codigo(codigo) on true
  join public.permisos as p
    on p.codigo = permiso_codigo.codigo
    and p.estado = 'activo'
  on conflict on constraint rol_permisos_empresa_rol_permiso_unique do nothing;

  insert into public.profiles (id, empresa_id, sucursal_id, rol_id, nombre, correo, telefono)
  values (
    v_user_id,
    v_empresa_id,
    v_sucursal_id,
    v_rol_id,
    trim(p_nombre_usuario),
    lower(trim(p_correo_usuario)),
    nullif(trim(p_telefono_usuario), '')
  );

  insert into public.empresa_modulos (empresa_id, modulo_id)
  select v_empresa_id, m.id
  from public.modulos as m
  where m.codigo in ('admin', 'crm', 'hr', 'reports')
    and m.estado = 'activo';

  select p.id
  into v_plan_id
  from public.planes as p
  where p.codigo = 'starter'
    and p.estado = 'activo'
  limit 1;

  if v_plan_id is null then
    raise exception 'Plan starter no encontrado.'
      using errcode = '23503';
  end if;

  insert into public.empresa_plan (empresa_id, plan_id)
  values (v_empresa_id, v_plan_id);

  insert into public.configuraciones_empresa (empresa_id, clave, valor)
  values (
    v_empresa_id,
    'general',
    jsonb_build_object('moneda', 'USD', 'zona_horaria', 'America/Costa_Rica', 'pais', 'CR')
  );

  insert into public.auditoria_eventos (
    empresa_id,
    usuario_id,
    sucursal_id,
    entidad,
    entidad_id,
    accion,
    metadata
  )
  values (
    v_empresa_id,
    v_user_id,
    v_sucursal_id,
    'empresas',
    v_empresa_id,
    'bootstrap_empresa_inicial',
    jsonb_build_object('plan_codigo', 'starter', 'rol_fundador', 'Super Admin')
  );

  return query
  select v_empresa_id, v_user_id, v_sucursal_id, v_rol_id, 'starter'::text;
end;
$$;

revoke all on function public.bootstrap_empresa_inicial(
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text
) from public;

grant execute on function public.bootstrap_empresa_inicial(
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text
) to authenticated;
