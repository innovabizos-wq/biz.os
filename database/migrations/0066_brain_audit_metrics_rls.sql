-- Allow Brain users to read audit events needed for task success metrics.
-- Additive policy update only; no data changes.

drop policy if exists auditoria_eventos_select_admin on public.auditoria_eventos;
create policy auditoria_eventos_select_admin
on public.auditoria_eventos
for select
to authenticated
using (
  empresa_id = public.current_empresa_id()
  and (
    public.current_user_has_permission('admin.settings.view')
    or public.current_user_has_permission('admin.settings.manage')
    or public.current_user_has_permission('brain.insights.view')
  )
);
