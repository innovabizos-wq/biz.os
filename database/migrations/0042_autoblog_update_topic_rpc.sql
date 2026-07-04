-- RPC to update an autoblog topic
create or replace function public.actualizar_autoblog_topic(
  p_topic_id uuid,
  p_title text,
  p_description text,
  p_source_mode text,
  p_source_urls jsonb
)
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

  if not (public.current_user_has_permission('autoblog.manage')) then
    raise exception 'Insufficient permissions';
  end if;

  update public.autoblog_topics
  set
    title = p_title,
    description = p_description,
    source_mode = p_source_mode,
    source_urls = p_source_urls,
    updated_at = now()
  where id = p_topic_id
    and empresa_id = v_empresa_id;
end;
$$;

grant execute on function public.actualizar_autoblog_topic(uuid, text, text, text, jsonb) to authenticated;
