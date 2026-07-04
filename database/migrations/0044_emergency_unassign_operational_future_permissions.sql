-- Emergency compatibility fix:
-- Keep the new operational permission catalog intact, but stop assigning those
-- future permissions automatically to existing system roles while production may
-- still be running a deployment with older permission enums.

delete from public.rol_permisos rp
using public.permisos p
where p.id = rp.permiso_id
  and p.codigo in (
    'purchases.suppliers.view',
    'purchases.suppliers.manage',
    'purchases.orders.view',
    'purchases.orders.manage',
    'payments.accounts.view',
    'payments.accounts.manage',
    'reports.dashboard.view',
    'ai.reports.use',
    'mobile.access'
  );
