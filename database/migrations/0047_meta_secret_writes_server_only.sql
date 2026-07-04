-- Move Meta secret writes behind service-role RPCs.
-- User-facing server actions still validate the signed-in actor first, then call
-- these RPCs with explicit actor and tenant identifiers.

create or replace function public.guardar_inbox_canal_meta_secretos_server(
  p_actor_id uuid,
  p_empresa_id uuid,
  p_canal_id uuid,
  p_access_token text default null,
  p_app_secret text default null,
  p_verify_token text default null,
  p_token_expires_at timestamptz default null
)
returns table (
  canal_id uuid,
  tiene_access_token boolean,
  tiene_app_secret boolean,
  tiene_verify_token boolean,
  token_expires_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := p_actor_id;
  v_empresa_id uuid := p_empresa_id;
  v_canal public.inbox_canales%rowtype;
  v_existing public.inbox_canal_secretos%rowtype;
  v_secretos public.inbox_canal_secretos%rowtype;
  v_access_token text := nullif(btrim(coalesce(p_access_token, '')), '');
  v_app_secret text := nullif(btrim(coalesce(p_app_secret, '')), '');
  v_verify_token text := nullif(btrim(coalesce(p_verify_token, '')), '');
  v_access_id uuid;
  v_app_id uuid;
  v_verify_id uuid;
begin
  if v_user_id is null or v_empresa_id is null then
    raise exception 'Actor y empresa requeridos.' using errcode = '28000';
  end if;

  if not public.profile_has_permission(v_user_id, v_empresa_id, 'inbox.channels.manage') then
    raise exception 'Permiso inbox.channels.manage requerido.' using errcode = '42501';
  end if;

  select * into v_canal
  from public.inbox_canales
  where id = p_canal_id and empresa_id = v_empresa_id;

  if v_canal.id is null then
    raise exception 'Canal no encontrado.' using errcode = '02000';
  end if;

  if v_canal.proveedor <> 'meta' then
    raise exception 'El canal no es proveedor Meta.' using errcode = '22023';
  end if;

  select * into v_existing
  from public.inbox_canal_secretos
  where canal_id = p_canal_id and empresa_id = v_empresa_id;

  v_access_id := public.upsert_vault_secret_ref(
    v_existing.access_token_secret_id,
    v_access_token,
    'bizos:meta:' || v_empresa_id || ':' || p_canal_id || ':access_token',
    'biz.os Meta access token'
  );
  v_app_id := public.upsert_vault_secret_ref(
    v_existing.app_secret_secret_id,
    v_app_secret,
    'bizos:meta:' || v_empresa_id || ':' || p_canal_id || ':app_secret',
    'biz.os Meta app secret'
  );
  v_verify_id := public.upsert_vault_secret_ref(
    v_existing.verify_token_secret_id,
    v_verify_token,
    'bizos:meta:' || v_empresa_id || ':' || p_canal_id || ':verify_token',
    'biz.os Meta verify token'
  );

  insert into public.inbox_canal_secretos (
    empresa_id,
    canal_id,
    access_token,
    app_secret,
    verify_token,
    access_token_secret_id,
    app_secret_secret_id,
    verify_token_secret_id,
    secret_storage,
    secrets_migrated_at,
    token_expires_at,
    metadata_privada,
    created_by,
    updated_by
  )
  values (
    v_empresa_id,
    p_canal_id,
    null,
    null,
    null,
    v_access_id,
    v_app_id,
    v_verify_id,
    case when v_access_id is not null or v_app_id is not null or v_verify_id is not null then 'vault' else 'inline' end,
    case when v_access_id is not null or v_app_id is not null or v_verify_id is not null then now() else null end,
    p_token_expires_at,
    jsonb_strip_nulls(jsonb_build_object(
      'access_token_updated_at', case when v_access_token is not null then now() else null end,
      'access_token_suffix', case when v_access_token is not null then right(v_access_token, 6) else null end,
      'secret_storage', case when v_access_id is not null or v_app_id is not null or v_verify_id is not null then 'vault' else null end
    )),
    v_user_id,
    v_user_id
  )
  on conflict on constraint inbox_canal_secretos_empresa_canal_unique
  do update set
    access_token = case when coalesce(v_access_id, public.inbox_canal_secretos.access_token_secret_id) is not null then null else public.inbox_canal_secretos.access_token end,
    app_secret = case when coalesce(v_app_id, public.inbox_canal_secretos.app_secret_secret_id) is not null then null else public.inbox_canal_secretos.app_secret end,
    verify_token = case when coalesce(v_verify_id, public.inbox_canal_secretos.verify_token_secret_id) is not null then null else public.inbox_canal_secretos.verify_token end,
    access_token_secret_id = coalesce(v_access_id, public.inbox_canal_secretos.access_token_secret_id),
    app_secret_secret_id = coalesce(v_app_id, public.inbox_canal_secretos.app_secret_secret_id),
    verify_token_secret_id = coalesce(v_verify_id, public.inbox_canal_secretos.verify_token_secret_id),
    secret_storage = case
      when coalesce(v_access_id, public.inbox_canal_secretos.access_token_secret_id) is not null
        or coalesce(v_app_id, public.inbox_canal_secretos.app_secret_secret_id) is not null
        or coalesce(v_verify_id, public.inbox_canal_secretos.verify_token_secret_id) is not null then 'vault'
      else public.inbox_canal_secretos.secret_storage
    end,
    secrets_migrated_at = case
      when coalesce(v_access_id, public.inbox_canal_secretos.access_token_secret_id) is not null
        or coalesce(v_app_id, public.inbox_canal_secretos.app_secret_secret_id) is not null
        or coalesce(v_verify_id, public.inbox_canal_secretos.verify_token_secret_id) is not null then coalesce(public.inbox_canal_secretos.secrets_migrated_at, now())
      else public.inbox_canal_secretos.secrets_migrated_at
    end,
    token_expires_at = coalesce(p_token_expires_at, public.inbox_canal_secretos.token_expires_at),
    metadata_privada = coalesce(public.inbox_canal_secretos.metadata_privada, '{}'::jsonb)
      || jsonb_strip_nulls(jsonb_build_object(
        'access_token_updated_at', case when v_access_token is not null then now() else null end,
        'access_token_suffix', case when v_access_token is not null then right(v_access_token, 6) else null end,
        'secret_storage', 'vault'
      )),
    updated_by = v_user_id
  returning * into v_secretos;

  update public.inbox_canales
  set conexion_estado = case
        when (v_secretos.access_token_secret_id is not null or v_secretos.access_token is not null)
         and (v_secretos.app_secret_secret_id is not null or v_secretos.app_secret is not null)
         and (v_secretos.verify_token_secret_id is not null or v_secretos.verify_token is not null)
        then 'configurado'
        else conexion_estado
      end,
      updated_by = v_user_id
  where id = p_canal_id and empresa_id = v_empresa_id;

  insert into public.auditoria_eventos (empresa_id, usuario_id, entidad, entidad_id, accion, metadata)
  values (
    v_empresa_id,
    v_user_id,
    'inbox_canal_secretos',
    v_secretos.id,
    'guardar_inbox_canal_meta_secretos_server',
    jsonb_build_object(
      'canal_id', p_canal_id,
      'secret_storage', v_secretos.secret_storage,
      'tiene_access_token', v_secretos.access_token_secret_id is not null or v_secretos.access_token is not null,
      'tiene_app_secret', v_secretos.app_secret_secret_id is not null or v_secretos.app_secret is not null,
      'tiene_verify_token', v_secretos.verify_token_secret_id is not null or v_secretos.verify_token is not null
    )
  );

  return query
  select
    v_secretos.canal_id,
    v_secretos.access_token_secret_id is not null or v_secretos.access_token is not null,
    v_secretos.app_secret_secret_id is not null or v_secretos.app_secret is not null,
    v_secretos.verify_token_secret_id is not null or v_secretos.verify_token is not null,
    v_secretos.token_expires_at;
end;
$$;

create or replace function public.regenerar_inbox_canal_verify_token_server(
  p_actor_id uuid,
  p_empresa_id uuid,
  p_canal_id uuid
)
returns table (
  canal_id uuid,
  verify_token text,
  tiene_access_token boolean,
  tiene_app_secret boolean,
  tiene_verify_token boolean,
  token_expires_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := p_actor_id;
  v_empresa_id uuid := p_empresa_id;
  v_canal public.inbox_canales%rowtype;
  v_existing public.inbox_canal_secretos%rowtype;
  v_secretos public.inbox_canal_secretos%rowtype;
  v_verify_token text := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  v_verify_id uuid;
begin
  if v_user_id is null or v_empresa_id is null then
    raise exception 'Actor y empresa requeridos.' using errcode = '28000';
  end if;

  if not public.profile_has_permission(v_user_id, v_empresa_id, 'inbox.channels.manage') then
    raise exception 'Permiso inbox.channels.manage requerido.' using errcode = '42501';
  end if;

  select c.* into v_canal
  from public.inbox_canales as c
  where c.id = p_canal_id
    and c.empresa_id = v_empresa_id;

  if v_canal.id is null then
    raise exception 'Canal no encontrado.' using errcode = '02000';
  end if;

  if v_canal.proveedor <> 'meta' then
    raise exception 'El canal no es proveedor Meta.' using errcode = '22023';
  end if;

  select * into v_existing
  from public.inbox_canal_secretos
  where canal_id = p_canal_id and empresa_id = v_empresa_id;

  v_verify_id := public.upsert_vault_secret_ref(
    v_existing.verify_token_secret_id,
    v_verify_token,
    'bizos:meta:' || v_empresa_id || ':' || p_canal_id || ':verify_token',
    'biz.os Meta verify token'
  );

  insert into public.inbox_canal_secretos (
    empresa_id,
    canal_id,
    verify_token,
    verify_token_secret_id,
    secret_storage,
    secrets_migrated_at,
    metadata_privada,
    created_by,
    updated_by
  )
  values (
    v_empresa_id,
    p_canal_id,
    null,
    v_verify_id,
    case when v_verify_id is not null then 'vault' else 'inline' end,
    case when v_verify_id is not null then now() else null end,
    jsonb_strip_nulls(jsonb_build_object(
      'secret_storage', case when v_verify_id is not null then 'vault' else null end
    )),
    v_user_id,
    v_user_id
  )
  on conflict on constraint inbox_canal_secretos_empresa_canal_unique
  do update set
    verify_token = case when v_verify_id is not null then null else v_verify_token end,
    verify_token_secret_id = coalesce(v_verify_id, public.inbox_canal_secretos.verify_token_secret_id),
    secret_storage = case
      when coalesce(v_verify_id, public.inbox_canal_secretos.verify_token_secret_id) is not null then 'vault'
      else public.inbox_canal_secretos.secret_storage
    end,
    secrets_migrated_at = case
      when coalesce(v_verify_id, public.inbox_canal_secretos.verify_token_secret_id) is not null then coalesce(public.inbox_canal_secretos.secrets_migrated_at, now())
      else public.inbox_canal_secretos.secrets_migrated_at
    end,
    metadata_privada = coalesce(public.inbox_canal_secretos.metadata_privada, '{}'::jsonb)
      || jsonb_strip_nulls(jsonb_build_object(
        'secret_storage', case when v_verify_id is not null then 'vault' else null end
      )),
    updated_by = v_user_id
  returning * into v_secretos;

  insert into public.auditoria_eventos (empresa_id, usuario_id, entidad, entidad_id, accion, metadata)
  values (
    v_empresa_id,
    v_user_id,
    'inbox_canal_secretos',
    v_secretos.id,
    'regenerar_inbox_canal_verify_token_server',
    jsonb_build_object('canal_id', p_canal_id, 'secret_storage', v_secretos.secret_storage)
  );

  return query
  select
    v_secretos.canal_id,
    v_verify_token,
    v_secretos.access_token_secret_id is not null or v_secretos.access_token is not null,
    v_secretos.app_secret_secret_id is not null or v_secretos.app_secret is not null,
    v_secretos.verify_token_secret_id is not null or v_secretos.verify_token is not null,
    v_secretos.token_expires_at;
end;
$$;

revoke all on function public.guardar_inbox_canal_meta_secretos(uuid, text, text, text, timestamptz)
from anon, authenticated, public;
revoke all on function public.regenerar_inbox_canal_verify_token(uuid)
from anon, authenticated, public;

revoke all on function public.guardar_inbox_canal_meta_secretos_server(uuid, uuid, uuid, text, text, text, timestamptz)
from anon, authenticated, public;
revoke all on function public.regenerar_inbox_canal_verify_token_server(uuid, uuid, uuid)
from anon, authenticated, public;

grant execute on function public.guardar_inbox_canal_meta_secretos_server(uuid, uuid, uuid, text, text, text, timestamptz)
to service_role;
grant execute on function public.regenerar_inbox_canal_verify_token_server(uuid, uuid, uuid)
to service_role;
