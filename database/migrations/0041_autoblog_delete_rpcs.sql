-- Add delete permission for Autoblog
insert into public.permisos (codigo, nombre, descripcion, modulo_codigo, estado)
values
  ('autoblog.delete', 'Eliminar articulos y temas de Autoblog', 'Permite eliminar articulos y temas de Autoblog.', 'autoblog', 'activo')
on conflict (codigo) do update
set nombre = excluded.nombre,
    descripcion = excluded.descripcion,
    modulo_codigo = excluded.modulo_codigo,
    estado = excluded.estado;

-- Assign delete permission to admin roles
insert into public.rol_permisos (empresa_id, rol_id, permiso_id)
select r.empresa_id, r.id, p.id
from public.roles as r
join public.permisos as p
  on p.codigo = 'autoblog.delete'
where r.es_sistema = true
  and r.nombre in ('Administrador', 'Super Admin')
on conflict on constraint rol_permisos_empresa_rol_permiso_unique
do nothing;

-- RPC to delete an autoblog article
create or replace function public.eliminar_autoblog_article(p_article_id uuid)
returns void
language plpgsql
as $$
declare
  v_empresa_id uuid;
begin
  select empresa_id into v_empresa_id
  from public.autoblog_articles
  where id = p_article_id;

  if v_empresa_id is null then
    raise exception 'Article not found';
  end if;

  if v_empresa_id <> public.current_empresa_id() then
    raise exception 'Unauthorized';
  end if;

  if not (public.current_user_has_permission('autoblog.delete') or public.current_user_has_permission('autoblog.manage')) then
    raise exception 'Insufficient permissions';
  end if;

  delete from public.autoblog_articles
  where id = p_article_id
    and empresa_id = v_empresa_id;
end;
$$;

-- RPC to delete an autoblog topic
create or replace function public.eliminar_autoblog_topic(p_topic_id uuid)
returns void
language plpgsql
as $$
declare
  v_empresa_id uuid;
begin
  select empresa_id into v_empresa_id
  from public.autoblog_topics
  where id = p_topic_id;

  if v_empresa_id is null then
    raise exception 'Topic not found';
  end if;

  if v_empresa_id <> public.current_empresa_id() then
    raise exception 'Unauthorized';
  end if;

  if not (public.current_user_has_permission('autoblog.delete') or public.current_user_has_permission('autoblog.manage')) then
    raise exception 'Insufficient permissions';
  end if;

  delete from public.autoblog_topics
  where id = p_topic_id
    and empresa_id = v_empresa_id;
end;
$$;

-- Update RLS policies for articles to allow delete via RPC? Actually, we handle permissions inside the RPC.
-- But we also need to allow direct delete via API? We are only using RPC, so we don't need to change table policies for delete.
-- However, we should ensure that the RPC is executable by authenticated users (we'll grant execute below).

-- Grant execute on the new RPCs
grant execute on function public.eliminar_autoblog_article(uuid) to authenticated;
grant execute on function public.eliminar_autoblog_topic(uuid) to authenticated;
