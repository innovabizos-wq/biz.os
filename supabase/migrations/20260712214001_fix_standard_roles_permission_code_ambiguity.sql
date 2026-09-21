create or replace function public.instalar_roles_estandar_empresa()
returns table (
  roles_creados integer,
  roles_existentes integer,
  permisos_asignados integer,
  advertencias text[]
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_empresa_id uuid := public.current_empresa_id();
  v_created integer := 0;
  v_existing integer := 0;
  v_assigned integer := 0;
  v_created_role_ids uuid[] := array[]::uuid[];
begin
  if v_user_id is null or v_empresa_id is null then
    raise exception 'Usuario autenticado requerido.' using errcode = '28000';
  end if;

  if not (
    public.current_user_has_permission('admin.roles.manage')
    or public.current_user_has_permission('admin.users.manage')
  ) then
    raise exception 'Permiso administrativo requerido.' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.empresas as e
    where e.id = v_empresa_id and e.estado = 'activa'
  ) then
    raise exception 'La empresa no esta activa.' using errcode = '22023';
  end if;

  select count(*) into v_existing
  from (values
    ('Super Admin'), ('Administrador'), ('Supervisor'), ('Vendedor'),
    ('Servicio al cliente'), ('Bodeguero'), ('Chofer / Repartidor'),
    ('Contabilidad / Facturacion'), ('RRHH')
  ) as standard_roles(nombre)
  where exists (
    select 1 from public.roles as r
    where r.empresa_id = v_empresa_id
      and lower(r.nombre) = lower(standard_roles.nombre)
  );

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
  ), inserted as (
    insert into public.roles (empresa_id, nombre, descripcion, es_sistema, estado)
    select v_empresa_id, sr.nombre, sr.descripcion, sr.es_sistema, 'activo'
    from standard_roles as sr
    where not exists (
      select 1 from public.roles as r
      where r.empresa_id = v_empresa_id and lower(r.nombre) = lower(sr.nombre)
    )
    returning id
  )
  select count(*), coalesce(array_agg(id), array[]::uuid[])
  into v_created, v_created_role_ids
  from inserted;

  insert into public.rol_permisos (empresa_id, rol_id, permiso_id)
  select v_empresa_id, r.id, p.id
  from public.roles as r
  join public.permisos as p on p.estado = 'activo'
  where r.empresa_id = v_empresa_id
    and r.id = any(v_created_role_ids)
    and case lower(r.nombre)
      when 'super admin' then true
      when 'administrador' then true
      when 'supervisor' then p.codigo = any(array[
        'admin.users.view', 'admin.roles.view', 'reports.dashboard.view',
        'crm.customers.view', 'crm.interactions.view', 'crm.followups.view',
        'quotes.view', 'sales.orders.view', 'inventory.products.view',
        'inventory.stock.view', 'inventory.movements.view', 'inventory.warehouses.view',
        'dispatch.orders.view', 'inbox.conversations.view', 'hr.timesheets.view',
        'hr.timesheets.dashboard'
      ]::text[])
      when 'vendedor' then p.codigo = any(array[
        'crm.customers.view', 'crm.customers.create', 'crm.customers.edit',
        'crm.interactions.view', 'crm.interactions.create', 'crm.followups.view',
        'crm.followups.create', 'crm.followups.edit', 'quotes.view', 'quotes.create',
        'quotes.edit', 'quotes.status.change', 'sales.orders.view',
        'sales.orders.create', 'sales.orders.status.change',
        'catalog.products.view', 'catalog.categories.view',
        'inbox.conversations.view', 'inbox.conversations.create', 'inbox.conversations.reply'
      ]::text[])
      when 'servicio al cliente' then p.codigo = any(array[
        'crm.customers.view', 'crm.customers.edit', 'crm.interactions.view',
        'crm.interactions.create', 'crm.followups.view', 'crm.followups.create',
        'crm.followups.edit', 'inbox.conversations.view', 'inbox.conversations.create',
        'inbox.conversations.reply', 'inbox.conversations.assign',
        'inbox.conversations.status.change'
      ]::text[])
      when 'bodeguero' then p.codigo = any(array[
        'catalog.products.view', 'catalog.categories.view', 'inventory.products.view',
        'inventory.stock.view', 'inventory.stock.adjust', 'inventory.movements.view',
        'inventory.warehouses.view', 'dispatch.orders.view'
      ]::text[])
      when 'chofer / repartidor' then p.codigo = any(array[
        'dispatch.orders.view', 'dispatch.orders.status.change', 'driver.tracking.use'
      ]::text[])
      when 'contabilidad / facturacion' then p.codigo = any(array[
        'crm.customers.view', 'quotes.view', 'sales.orders.view', 'sales.orders.edit',
        'reports.dashboard.view'
      ]::text[])
      when 'rrhh' then p.codigo = any(array[
        'admin.users.view', 'admin.users.manage', 'admin.roles.view',
        'hr.timesheets.view', 'hr.timesheets.manage', 'hr.timesheets.dashboard',
        'hr.timesheets.states.manage', 'reports.dashboard.view'
      ]::text[])
      else false
    end
  on conflict on constraint rol_permisos_empresa_rol_permiso_unique do nothing;

  get diagnostics v_assigned = row_count;

  return query
  select v_created, v_existing, v_assigned, array[
    'Los permisos se asignaron solo a roles nuevos y activos.',
    'Chofer / Repartidor queda preparado para despacho y seguimiento de entregas.'
  ]::text[];
end;
$$;

revoke all on function public.instalar_roles_estandar_empresa() from public;
grant execute on function public.instalar_roles_estandar_empresa() to authenticated;
