-- Production hardening: Vault-backed Meta secrets, server-only send config,
-- explicit privileged RPC allowlist and computed module health.

create or replace function public.profile_has_permission(
  p_profile_id uuid,
  p_empresa_id uuid,
  p_permission_code text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles as p
    join public.rol_permisos as rp
      on rp.empresa_id = p.empresa_id
     and rp.rol_id = p.rol_id
    join public.permisos as perm
      on perm.id = rp.permiso_id
    where p.id = p_profile_id
      and p.empresa_id = p_empresa_id
      and p.estado = 'activo'
      and perm.codigo = p_permission_code
      and perm.estado = 'activo'
  );
$$;

create or replace function public.upsert_vault_secret_ref(
  p_secret_id uuid,
  p_secret_value text,
  p_secret_name text,
  p_description text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_value text := nullif(btrim(coalesce(p_secret_value, '')), '');
  v_name text := nullif(btrim(coalesce(p_secret_name, '')), '');
  v_id uuid := p_secret_id;
begin
  if v_value is null then
    return p_secret_id;
  end if;

  if v_id is null then
    select id into v_id from vault.decrypted_secrets where name = v_name limit 1;
  end if;

  if v_id is null then
    select vault.create_secret(v_value, v_name, p_description) into v_id;
  else
    perform vault.update_secret(v_id, v_value, v_name, p_description);
  end if;

  return v_id;
end;
$$;

create or replace function public.resolve_vault_or_inline_secret(
  p_secret_id uuid,
  p_inline_secret text
)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_secret text;
begin
  if p_secret_id is not null then
    select decrypted_secret into v_secret
    from vault.decrypted_secrets
    where id = p_secret_id
    limit 1;
  end if;

  return coalesce(nullif(v_secret, ''), nullif(btrim(coalesce(p_inline_secret, '')), ''));
end;
$$;

create or replace function public.migrate_inbox_meta_secrets_to_vault()
returns table (migrated_rows integer, cleared_inline_rows integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.inbox_canal_secretos%rowtype;
  v_access_id uuid;
  v_app_id uuid;
  v_verify_id uuid;
  v_migrated integer := 0;
  v_cleared integer := 0;
begin
  for v_row in
    select *
    from public.inbox_canal_secretos
    where access_token is not null
       or app_secret is not null
       or verify_token is not null
       or access_token_secret_id is not null
       or app_secret_secret_id is not null
       or verify_token_secret_id is not null
  loop
    v_access_id := public.upsert_vault_secret_ref(
      v_row.access_token_secret_id,
      v_row.access_token,
      'bizos:meta:' || v_row.empresa_id || ':' || v_row.canal_id || ':access_token',
      'biz.os Meta access token'
    );
    v_app_id := public.upsert_vault_secret_ref(
      v_row.app_secret_secret_id,
      v_row.app_secret,
      'bizos:meta:' || v_row.empresa_id || ':' || v_row.canal_id || ':app_secret',
      'biz.os Meta app secret'
    );
    v_verify_id := public.upsert_vault_secret_ref(
      v_row.verify_token_secret_id,
      v_row.verify_token,
      'bizos:meta:' || v_row.empresa_id || ':' || v_row.canal_id || ':verify_token',
      'biz.os Meta verify token'
    );

    update public.inbox_canal_secretos as s
    set access_token_secret_id = v_access_id,
        app_secret_secret_id = v_app_id,
        verify_token_secret_id = v_verify_id,
        access_token = case when v_access_id is not null then null else s.access_token end,
        app_secret = case when v_app_id is not null then null else s.app_secret end,
        verify_token = case when v_verify_id is not null then null else s.verify_token end,
        secret_storage = case
          when v_access_id is not null or v_app_id is not null or v_verify_id is not null then 'vault'
          else 'inline'
        end,
        secrets_migrated_at = case
          when v_access_id is not null or v_app_id is not null or v_verify_id is not null then now()
          else s.secrets_migrated_at
        end,
        metadata_privada = coalesce(s.metadata_privada, '{}'::jsonb)
          || jsonb_build_object('secret_storage', 'vault', 'secrets_migrated_at', now())
    where s.id = v_row.id;

    v_migrated := v_migrated + 1;
    if v_access_id is not null or v_app_id is not null or v_verify_id is not null then
      v_cleared := v_cleared + 1;
    end if;
  end loop;

  return query select v_migrated, v_cleared;
end;
$$;

create or replace function public.guardar_inbox_canal_meta_secretos(
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
  v_user_id uuid := auth.uid();
  v_empresa_id uuid := public.current_empresa_id();
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
    raise exception 'Usuario autenticado requerido.' using errcode = '28000';
  end if;

  if not public.current_user_has_permission('inbox.channels.manage') then
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
    'guardar_inbox_canal_meta_secretos',
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

drop function if exists public.obtener_inbox_canal_meta_estado(uuid);

create function public.obtener_inbox_canal_meta_estado(p_canal_id uuid)
returns table (
  canal_id uuid,
  proveedor text,
  canal text,
  conexion_estado text,
  tiene_access_token boolean,
  tiene_app_secret boolean,
  tiene_verify_token boolean,
  token_expires_at timestamptz,
  webhook_url text,
  access_token_updated_at timestamptz,
  access_token_suffix text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_empresa_id uuid := public.current_empresa_id();
begin
  if v_user_id is null or v_empresa_id is null then
    raise exception 'Usuario autenticado requerido.' using errcode = '28000';
  end if;

  if not (
    public.current_user_has_permission('inbox.channels.view')
    or public.current_user_has_permission('inbox.channels.manage')
  ) then
    raise exception 'Permiso inbox.channels.view requerido.' using errcode = '42501';
  end if;

  return query
  select
    c.id,
    c.proveedor,
    c.canal,
    c.conexion_estado,
    s.access_token_secret_id is not null or s.access_token is not null,
    s.app_secret_secret_id is not null or s.app_secret is not null,
    s.verify_token_secret_id is not null or s.verify_token is not null,
    s.token_expires_at,
    c.webhook_url,
    nullif(s.metadata_privada->>'access_token_updated_at', '')::timestamptz,
    nullif(s.metadata_privada->>'access_token_suffix', '')
  from public.inbox_canales as c
  left join public.inbox_canal_secretos as s
    on s.canal_id = c.id and s.empresa_id = c.empresa_id
  where c.id = p_canal_id and c.empresa_id = v_empresa_id;
end;
$$;

create or replace function public.buscar_canal_por_verify_token(p_verify_token text)
returns table (canal_id uuid, empresa_id uuid, canal text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if nullif(btrim(coalesce(p_verify_token, '')), '') is null then
    return;
  end if;

  return query
  select c.id, c.empresa_id, c.canal
  from public.inbox_canales as c
  join public.inbox_canal_secretos as s
    on s.canal_id = c.id and s.empresa_id = c.empresa_id
  where c.proveedor = 'meta'
    and c.estado <> 'inactivo'
    and public.resolve_vault_or_inline_secret(s.verify_token_secret_id, s.verify_token) = p_verify_token
  limit 1;
end;
$$;

create or replace function public.verificar_meta_webhook_signature(
  p_payload text,
  p_signature text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_expected text;
  v_secret text;
begin
  if nullif(coalesce(p_payload, ''), '') is null
    or nullif(coalesce(p_signature, ''), '') is null then
    return false;
  end if;

  for v_secret in
    select public.resolve_vault_or_inline_secret(s.app_secret_secret_id, s.app_secret)
    from public.inbox_canal_secretos as s
    join public.inbox_canales as c
      on c.id = s.canal_id and c.empresa_id = s.empresa_id
    where c.proveedor = 'meta'
      and c.estado <> 'inactivo'
      and (s.app_secret_secret_id is not null or s.app_secret is not null)
  loop
    continue when nullif(v_secret, '') is null;

    v_expected := 'sha256=' || encode(
      extensions.hmac(convert_to(p_payload, 'UTF8'), convert_to(v_secret, 'UTF8'), 'sha256'),
      'hex'
    );

    if lower(v_expected) = lower(p_signature) then
      return true;
    end if;
  end loop;

  return false;
end;
$$;

create or replace function public.obtener_inbox_whatsapp_send_config_server(
  p_conversacion_id uuid,
  p_empresa_id uuid,
  p_actor_id uuid
)
returns table (
  conversacion_id uuid,
  empresa_id uuid,
  canal_id uuid,
  channel_name text,
  phone_number_id text,
  to_phone text,
  access_token text,
  access_token_updated_at timestamptz,
  access_token_suffix text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_conversacion public.inbox_conversaciones%rowtype;
  v_canal public.inbox_canales%rowtype;
  v_secretos public.inbox_canal_secretos%rowtype;
  v_access_token text;
  v_phone_number_id text;
  v_to_phone text;
begin
  if not public.profile_has_permission(p_actor_id, p_empresa_id, 'inbox.conversations.reply') then
    raise exception 'Permiso inbox.conversations.reply requerido.' using errcode = '42501';
  end if;

  select * into v_conversacion
  from public.inbox_conversaciones
  where id = p_conversacion_id and empresa_id = p_empresa_id;

  if v_conversacion.id is null or v_conversacion.canal_id is null then
    raise exception 'Conversacion WhatsApp no encontrada.' using errcode = 'P0002';
  end if;

  select * into v_canal
  from public.inbox_canales
  where id = v_conversacion.canal_id and empresa_id = p_empresa_id;

  if v_canal.id is null
    or v_canal.proveedor <> 'meta'
    or v_canal.canal <> 'whatsapp'
    or v_canal.estado <> 'activo'
    or v_canal.conexion_estado <> 'configurado' then
    raise exception 'Canal WhatsApp Meta no configurado.' using errcode = '22023';
  end if;

  select * into v_secretos
  from public.inbox_canal_secretos
  where canal_id = v_canal.id and empresa_id = p_empresa_id;

  v_access_token := public.resolve_vault_or_inline_secret(v_secretos.access_token_secret_id, v_secretos.access_token);
  v_phone_number_id := nullif(btrim(v_canal.configuracion_publica->>'phone_number_id'), '');
  v_to_phone := regexp_replace(
    coalesce(
      nullif(v_conversacion.contacto_telefono, ''),
      nullif(v_conversacion.contacto_identificador, ''),
      nullif(v_conversacion.contacto_usuario, '')
    ),
    '[^0-9]',
    '',
    'g'
  );

  if v_access_token is null or v_phone_number_id is null or v_to_phone is null or length(v_to_phone) < 8 then
    raise exception 'Configuracion de envio WhatsApp incompleta.' using errcode = '22023';
  end if;

  return query
  select
    v_conversacion.id,
    p_empresa_id,
    v_canal.id,
    v_canal.nombre,
    v_phone_number_id,
    v_to_phone,
    v_access_token,
    nullif(v_secretos.metadata_privada->>'access_token_updated_at', '')::timestamptz,
    nullif(v_secretos.metadata_privada->>'access_token_suffix', '');
end;
$$;

create or replace function public.recalcular_salud_modulos_empresa(p_empresa_id uuid)
returns table (
  modulo_codigo text,
  status text,
  configuration_complete boolean,
  credentials_present boolean,
  last_success_at timestamptz,
  last_error_at timestamptz,
  last_error text,
  metadata jsonb
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.empresa_modulo_health (
    empresa_id,
    modulo_codigo,
    status,
    configuration_complete,
    credentials_present,
    last_success_at,
    last_error_at,
    last_error,
    metadata
  )
  select
    calculated.empresa_id,
    calculated.modulo_codigo,
    calculated.status,
    calculated.configuration_complete,
    calculated.credentials_present,
    case when calculated.status = 'healthy' then now() else h.last_success_at end,
    case when calculated.status in ('misconfigured', 'unhealthy') then now() else h.last_error_at end,
    calculated.last_error,
    calculated.metadata
  from (
    select
      base.*,
      case
        when base.company_status <> 'activo' then 'inactive'
        when base.configuration_complete and base.credentials_present then 'healthy'
        else 'misconfigured'
      end as status,
      case
        when base.company_status <> 'activo' then null
        when not base.configuration_complete then 'Configuracion incompleta.'
        when not base.credentials_present then 'Credenciales incompletas.'
        else null
      end as last_error
    from (
      select
        e.id as empresa_id,
        m.codigo as modulo_codigo,
        coalesce(em.estado, 'inactivo') as company_status,
        case m.codigo
          when 'admin' then exists (select 1 from public.profiles p where p.empresa_id = e.id and p.estado = 'activo')
          when 'inventory' then exists (select 1 from public.inventario_bodegas b where b.empresa_id = e.id)
          when 'hr' then exists (select 1 from public.rrhh_planilla_estados r where r.empresa_id = e.id)
          when 'billing' then exists (
            select 1 from public.configuraciones_empresa ce
            where ce.empresa_id = e.id and ce.clave = 'fiscal'
              and nullif(ce.valor->>'razonSocial', '') is not null
              and nullif(ce.valor->>'identificacion', '') is not null
              and nullif(ce.valor->>'actividadEconomica', '') is not null
              and nullif(ce.valor->>'correoEmisor', '') is not null
          )
          when 'whapp' then exists (
            select 1 from public.inbox_canales c
            where c.empresa_id = e.id and c.proveedor = 'meta' and c.canal = 'whatsapp'
              and c.estado = 'activo' and c.conexion_estado = 'configurado'
              and nullif(c.configuracion_publica->>'phone_number_id', '') is not null
          )
          when 'autoblog' then exists (select 1 from public.business_context bc where bc.empresa_id = e.id)
          when 'ai' then false
          when 'purchases' then false
          when 'payments' then false
          when 'mobile' then false
          else true
        end as configuration_complete,
        case m.codigo
          when 'billing' then exists (
            select 1 from public.configuraciones_empresa ce
            where ce.empresa_id = e.id and ce.clave = 'fiscal'
              and nullif(ce.valor->>'haciendaUsuarioEnc', '') is not null
              and nullif(ce.valor->>'haciendaPasswordEnc', '') is not null
              and nullif(ce.valor->>'p12Base64Enc', '') is not null
              and nullif(ce.valor->>'pinEnc', '') is not null
          )
          when 'whapp' then exists (
            select 1
            from public.inbox_canales c
            join public.inbox_canal_secretos s
              on s.empresa_id = c.empresa_id and s.canal_id = c.id
            where c.empresa_id = e.id and c.proveedor = 'meta' and c.canal = 'whatsapp'
              and c.estado = 'activo'
              and (s.access_token_secret_id is not null or nullif(s.access_token, '') is not null)
              and (s.app_secret_secret_id is not null or nullif(s.app_secret, '') is not null)
              and (s.verify_token_secret_id is not null or nullif(s.verify_token, '') is not null)
          )
          else true
        end as credentials_present,
        jsonb_build_object(
          'calculated_from', '0040_production_hardening_vault_health_rpc',
          'company_status', coalesce(em.estado, 'inactivo'),
          'meta_secret_storage', coalesce((
            select jsonb_agg(distinct s.secret_storage)
            from public.inbox_canal_secretos s
            where s.empresa_id = e.id
          ), '[]'::jsonb)
        ) as metadata
      from public.empresas e
      cross join public.modulos m
      left join public.empresa_modulos em on em.empresa_id = e.id and em.modulo_id = m.id
      where e.id = p_empresa_id and m.estado = 'activo'
    ) as base
  ) as calculated
  left join public.empresa_modulo_health h
    on h.empresa_id = calculated.empresa_id and h.modulo_codigo = calculated.modulo_codigo
  on conflict on constraint empresa_modulo_health_unique
  do update set
    status = excluded.status,
    configuration_complete = excluded.configuration_complete,
    credentials_present = excluded.credentials_present,
    last_success_at = excluded.last_success_at,
    last_error_at = excluded.last_error_at,
    last_error = excluded.last_error,
    metadata = excluded.metadata,
    updated_at = now();

  return query
  select h.modulo_codigo, h.status, h.configuration_complete, h.credentials_present,
         h.last_success_at, h.last_error_at, h.last_error, h.metadata
  from public.empresa_modulo_health h
  where h.empresa_id = p_empresa_id
  order by h.modulo_codigo;
end;
$$;

create or replace function public.recalcular_salud_modulos_empresa_actual()
returns table (
  modulo_codigo text,
  status text,
  configuration_complete boolean,
  credentials_present boolean,
  last_success_at timestamptz,
  last_error_at timestamptz,
  last_error text,
  metadata jsonb
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_empresa_id uuid := public.current_empresa_id();
begin
  if v_user_id is null or v_empresa_id is null then
    raise exception 'Usuario autenticado requerido.' using errcode = '28000';
  end if;

  if not public.current_user_has_permission('admin.settings.manage') then
    raise exception 'Permiso admin.settings.manage requerido.' using errcode = '42501';
  end if;

  return query select * from public.recalcular_salud_modulos_empresa(v_empresa_id);
end;
$$;

revoke all on function public.profile_has_permission(uuid, uuid, text) from public;
revoke all on function public.upsert_vault_secret_ref(uuid, text, text, text) from public;
revoke all on function public.resolve_vault_or_inline_secret(uuid, text) from public;
revoke all on function public.migrate_inbox_meta_secrets_to_vault() from public;
revoke all on function public.guardar_inbox_canal_meta_secretos(uuid, text, text, text, timestamptz) from public;
revoke all on function public.obtener_inbox_canal_meta_estado(uuid) from public;
revoke all on function public.buscar_canal_por_verify_token(text) from public;
revoke all on function public.verificar_meta_webhook_signature(text, text) from public;
revoke all on function public.obtener_inbox_whatsapp_send_config(uuid) from public;
revoke all on function public.obtener_inbox_whatsapp_send_config_server(uuid, uuid, uuid) from public;
revoke all on function public.recalcular_salud_modulos_empresa(uuid) from public;
revoke all on function public.recalcular_salud_modulos_empresa_actual() from public;

grant execute on function public.guardar_inbox_canal_meta_secretos(uuid, text, text, text, timestamptz) to authenticated;
grant execute on function public.obtener_inbox_canal_meta_estado(uuid) to authenticated;
grant execute on function public.buscar_canal_por_verify_token(text) to service_role;
grant execute on function public.verificar_meta_webhook_signature(text, text) to service_role;
grant execute on function public.obtener_inbox_whatsapp_send_config_server(uuid, uuid, uuid) to service_role;
grant execute on function public.recalcular_salud_modulos_empresa(uuid) to service_role;
grant execute on function public.recalcular_salud_modulos_empresa_actual() to authenticated;

select public.migrate_inbox_meta_secrets_to_vault();

do $$
declare
  v_empresa_id uuid;
begin
  for v_empresa_id in select id from public.empresas loop
    perform public.recalcular_salud_modulos_empresa(v_empresa_id);
  end loop;
end;
$$;
