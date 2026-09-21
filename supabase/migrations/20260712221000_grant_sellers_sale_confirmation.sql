-- A seller owns the commercial cycle through confirmation. Dispatch, inventory
-- adjustments and billing remain separately permissioned.
insert into public.rol_permisos (empresa_id, rol_id, permiso_id)
select r.empresa_id, r.id, p.id
from public.roles as r
join public.permisos as p
  on p.codigo = 'sales.orders.status.change'
 and p.estado = 'activo'
where lower(r.nombre) = 'vendedor'
  and r.estado = 'activo'
on conflict on constraint rol_permisos_empresa_rol_permiso_unique do nothing;
