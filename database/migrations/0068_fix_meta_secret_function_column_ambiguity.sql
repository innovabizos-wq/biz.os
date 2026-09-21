-- The output column canal_id conflicts with inbox_canal_secretos.canal_id in
-- these PL/pgSQL functions. Recreate their existing definitions after
-- qualifying the table fields, preserving the vault-based implementation.
do $$
declare
  v_definition text;
begin
  select pg_get_functiondef(
    'public.guardar_inbox_canal_meta_secretos_server(uuid, uuid, uuid, text, text, text, timestamptz)'::regprocedure
  ) into v_definition;

  v_definition := regexp_replace(
    v_definition,
    'from public\\.inbox_canal_secretos\\s+where canal_id = p_canal_id and empresa_id = v_empresa_id;',
    'from public.inbox_canal_secretos as s where s.canal_id = p_canal_id and s.empresa_id = v_empresa_id;',
    'g'
  );
  execute v_definition;

  select pg_get_functiondef(
    'public.regenerar_inbox_canal_verify_token_server(uuid, uuid, uuid)'::regprocedure
  ) into v_definition;

  v_definition := regexp_replace(
    v_definition,
    'from public\\.inbox_canal_secretos\\s+where canal_id = p_canal_id and empresa_id = v_empresa_id;',
    'from public.inbox_canal_secretos as s where s.canal_id = p_canal_id and s.empresa_id = v_empresa_id;',
    'g'
  );
  execute v_definition;
end;
$$;
