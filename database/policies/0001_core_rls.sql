-- biz.os core RLS policies.
-- This file is local only. Review before applying it to any Supabase project.

alter table public.empresas enable row level security;
alter table public.sucursales enable row level security;
alter table public.profiles enable row level security;
alter table public.roles enable row level security;
alter table public.permisos enable row level security;
alter table public.rol_permisos enable row level security;
alter table public.modulos enable row level security;
alter table public.empresa_modulos enable row level security;
alter table public.planes enable row level security;
alter table public.empresa_plan enable row level security;
alter table public.configuraciones_empresa enable row level security;
alter table public.auditoria_eventos enable row level security;

grant usage on schema public to authenticated;

grant select on public.empresas to authenticated;
grant select on public.sucursales to authenticated;
grant select on public.profiles to authenticated;
grant select on public.roles to authenticated;
grant select on public.permisos to authenticated;
grant select on public.rol_permisos to authenticated;
grant select on public.modulos to authenticated;
grant select on public.empresa_modulos to authenticated;
grant select on public.planes to authenticated;
grant select on public.empresa_plan to authenticated;

revoke all on public.configuraciones_empresa from authenticated;
revoke insert, update, delete on public.permisos from authenticated;
revoke insert, update, delete on public.modulos from authenticated;
revoke insert, update, delete on public.planes from authenticated;

create policy empresas_select_own
on public.empresas
for select
to authenticated
using (id = public.current_empresa_id());

create policy sucursales_select_own_empresa
on public.sucursales
for select
to authenticated
using (empresa_id = public.current_empresa_id());

create policy profiles_select_self
on public.profiles
for select
to authenticated
using (id = auth.uid());

create policy roles_select_own_empresa
on public.roles
for select
to authenticated
using (empresa_id = public.current_empresa_id());

create policy rol_permisos_select_current_role
on public.rol_permisos
for select
to authenticated
using (
  empresa_id = public.current_empresa_id()
  and rol_id = (
    select p.rol_id
    from public.profiles as p
    where p.id = auth.uid()
      and p.estado = 'activo'
    limit 1
  )
);

create policy empresa_modulos_select_active_own_empresa
on public.empresa_modulos
for select
to authenticated
using (
  empresa_id = public.current_empresa_id()
  and estado = 'activo'
);

create policy empresa_plan_select_own_empresa
on public.empresa_plan
for select
to authenticated
using (empresa_id = public.current_empresa_id());

create policy permisos_select_active_catalog
on public.permisos
for select
to authenticated
using (estado = 'activo');

create policy modulos_select_active_catalog
on public.modulos
for select
to authenticated
using (estado = 'activo');

create policy planes_select_active_catalog
on public.planes
for select
to authenticated
using (estado = 'activo');

-- auditoria_eventos intentionally has no policy for authenticated users yet.
-- Future reads/writes must go through backend permission checks and service code.
-- configuraciones_empresa is also closed to normal users in this phase because
-- future integration secrets and private settings must not be browser-readable.
-- No policy in this file uses platform superadmin exceptions or empresa_id null bypasses.
