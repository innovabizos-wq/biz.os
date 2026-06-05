-- Avoid per-row reevaluation of auth and permission helpers in hot RLS policies.

drop policy if exists rrhh_planilla_eventos_select_permission on public.rrhh_planilla_eventos;
create policy rrhh_planilla_eventos_select_permission
on public.rrhh_planilla_eventos
for select
to authenticated
using (
  empresa_id = (select public.current_empresa_id())
  and (
    (select public.current_user_has_permission('hr.timesheets.view'))
    or (select public.current_user_has_permission('hr.timesheets.dashboard'))
    or (select public.current_user_has_permission('hr.timesheets.manage'))
    or (
      (select public.current_user_has_permission('hr.timesheets.register'))
      and profile_id = (select auth.uid())
    )
  )
);

drop policy if exists driver_live_status_select_own_or_permission on public.driver_live_status;
create policy driver_live_status_select_own_or_permission
on public.driver_live_status
for select
to authenticated
using (
  empresa_id = (select public.current_empresa_id())
  and (
    profile_id = (select auth.uid())
    or (select public.current_user_has_permission('dispatch.orders.view'))
    or (select public.current_user_has_permission('dispatch.orders.edit'))
    or (select public.current_user_has_permission('driver.tracking.view'))
    or (select public.current_user_has_permission('driver.tracking.manage'))
  )
);

drop policy if exists driver_live_status_update_own on public.driver_live_status;
create policy driver_live_status_update_own
on public.driver_live_status
for update
to authenticated
using (
  empresa_id = (select public.current_empresa_id())
  and profile_id = (select auth.uid())
  and (select public.current_user_has_permission('driver.tracking.use'))
)
with check (
  empresa_id = (select public.current_empresa_id())
  and profile_id = (select auth.uid())
  and (select public.current_user_has_permission('driver.tracking.use'))
);

drop policy if exists user_notifications_select_own on public.user_notifications;
create policy user_notifications_select_own
on public.user_notifications
for select
to authenticated
using (
  empresa_id = (select public.current_empresa_id())
  and recipient_profile_id = (select auth.uid())
);

drop policy if exists user_notifications_update_own_read_at on public.user_notifications;
create policy user_notifications_update_own_read_at
on public.user_notifications
for update
to authenticated
using (
  empresa_id = (select public.current_empresa_id())
  and recipient_profile_id = (select auth.uid())
)
with check (
  empresa_id = (select public.current_empresa_id())
  and recipient_profile_id = (select auth.uid())
);

drop policy if exists profiles_select_permission on public.profiles;
create policy profiles_select_permission
on public.profiles
for select
to authenticated
using (
  id = (select auth.uid())
  or (
    empresa_id = (select public.current_empresa_id())
    and (
      (select public.current_user_has_permission('admin.users.view'))
      or (select public.current_user_has_permission('admin.users.manage'))
    )
  )
);

drop policy if exists rol_permisos_select_permission on public.rol_permisos;
create policy rol_permisos_select_permission
on public.rol_permisos
for select
to authenticated
using (
  empresa_id = (select public.current_empresa_id())
  and (
    rol_id = (
      select p.rol_id
      from public.profiles as p
      where p.id = (select auth.uid())
        and p.estado = 'activo'
      limit 1
    )
    or (select public.current_user_has_permission('admin.roles.view'))
    or (select public.current_user_has_permission('admin.roles.manage'))
  )
);
