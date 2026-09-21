-- Additive repair for standard roles created before the operational modules
-- reached the current permission matrix. This migration only inserts missing
-- role-permission rows and never removes or rewrites existing permissions.

insert into public.rol_permisos (empresa_id, rol_id, permiso_id)
select r.empresa_id, r.id, p.id
from public.roles as r
join public.permisos as p
  on p.estado = 'activo'
where r.estado = 'activo'
  and case lower(r.nombre)
    when 'super admin' then true
    when 'administrador' then true
    when 'vendedor' then p.codigo = any(array[
      'crm.customers.view',
      'crm.customers.create',
      'crm.customers.edit',
      'crm.interactions.view',
      'crm.interactions.create',
      'crm.followups.view',
      'crm.followups.create',
      'crm.followups.edit',
      'quotes.view',
      'quotes.create',
      'quotes.edit',
      'quotes.status.change',
      'sales.orders.view',
      'sales.orders.create',
      'sales.orders.status.change',
      'catalog.products.view',
      'catalog.categories.view',
      'inventory.stock.view',
      'inbox.conversations.view',
      'inbox.conversations.create',
      'inbox.conversations.reply'
    ]::text[])
    when 'bodeguero' then p.codigo = any(array[
      'catalog.products.view',
      'catalog.categories.view',
      'inventory.products.view',
      'inventory.stock.view',
      'inventory.stock.adjust',
      'inventory.movements.view',
      'inventory.warehouses.view',
      'inventory.warehouses.manage',
      'dispatch.orders.view',
      'dispatch.orders.edit'
    ]::text[])
    when 'chofer / repartidor' then p.codigo = any(array[
      'dispatch.orders.view',
      'dispatch.orders.status.change',
      'driver.tracking.use'
    ]::text[])
    when 'contabilidad / facturacion' then (
      p.codigo = any(array[
        'crm.customers.view',
        'quotes.view',
        'sales.orders.view',
        'sales.orders.edit',
        'reports.dashboard.view',
        'payments.accounts.view',
        'payments.accounts.manage',
        'purchases.suppliers.view',
        'purchases.orders.view'
      ]::text[])
      or p.codigo like 'billing.%'
    )
    else false
  end
on conflict on constraint rol_permisos_empresa_rol_permiso_unique do nothing;
