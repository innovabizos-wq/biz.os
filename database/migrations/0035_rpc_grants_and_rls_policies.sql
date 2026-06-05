-- RPC grants, closed configuration access and RLS policy cleanup.
-- Apply through Supabase migrations. Does not delete business data.

grant usage on schema public to authenticated;

do $$
declare
  v_proc regprocedure;
begin
  v_proc := to_regprocedure('public.rls_auto_enable()');
  if v_proc is not null then
    execute format('revoke all on function %s from public', v_proc);
    execute format('revoke all on function %s from anon', v_proc);
    execute format('revoke all on function %s from authenticated', v_proc);
  end if;

  v_proc := to_regprocedure('public.agregar_item_cotizacion(uuid,text,numeric,numeric,numeric,numeric)');
  if v_proc is not null then
    execute format('revoke all on function %s from public', v_proc);
    execute format('revoke all on function %s from anon', v_proc);
    execute format('grant execute on function %s to authenticated', v_proc);
  end if;

  v_proc := to_regprocedure('public.actualizar_item_cotizacion(uuid,text,numeric,numeric,numeric,numeric)');
  if v_proc is not null then
    execute format('revoke all on function %s from public', v_proc);
    execute format('revoke all on function %s from anon', v_proc);
    execute format('grant execute on function %s to authenticated', v_proc);
  end if;

  v_proc := to_regprocedure('public.buscar_canal_por_verify_token(text)');
  if v_proc is not null then
    execute format('revoke all on function %s from public', v_proc);
    execute format('revoke all on function %s from anon', v_proc);
    execute format('revoke all on function %s from authenticated', v_proc);
    execute format('grant execute on function %s to service_role', v_proc);
  end if;

  v_proc := to_regprocedure('public.verificar_meta_webhook_signature(text,text)');
  if v_proc is not null then
    execute format('revoke all on function %s from public', v_proc);
    execute format('revoke all on function %s from anon', v_proc);
    execute format('revoke all on function %s from authenticated', v_proc);
    execute format('grant execute on function %s to service_role', v_proc);
  end if;

  v_proc := to_regprocedure('public.procesar_inbox_webhook_meta(jsonb,jsonb)');
  if v_proc is not null then
    execute format('revoke all on function %s from public', v_proc);
    execute format('revoke all on function %s from anon', v_proc);
    execute format('revoke all on function %s from authenticated', v_proc);
    execute format('grant execute on function %s to service_role', v_proc);
  end if;
end;
$$;

grant select on public.auditoria_eventos to authenticated;
revoke all on public.configuraciones_empresa from anon, authenticated;
revoke all on public.inbox_canal_secretos from anon, authenticated;

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
  )
);

drop policy if exists configuraciones_empresa_no_direct_access on public.configuraciones_empresa;
create policy configuraciones_empresa_no_direct_access
on public.configuraciones_empresa
for all
to authenticated
using (false)
with check (false);

drop policy if exists inbox_canal_secretos_no_direct_access on public.inbox_canal_secretos;
create policy inbox_canal_secretos_no_direct_access
on public.inbox_canal_secretos
for all
to authenticated
using (false)
with check (false);

create or replace function public.redact_fiscal_config(p_valor jsonb)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'actividadEconomica', p_valor->'actividadEconomica',
    'ambiente', coalesce(nullif(p_valor->>'ambiente', ''), 'pruebas'),
    'correoEmisor', p_valor->'correoEmisor',
    'hasHaciendaPassword',
      ((p_valor->>'hasHaciendaPassword') = 'true')
      or nullif(p_valor->>'haciendaPasswordEnc', '') is not null,
    'hasHaciendaUsuario',
      ((p_valor->>'hasHaciendaUsuario') = 'true')
      or nullif(p_valor->>'haciendaUsuarioEnc', '') is not null,
    'hasP12',
      ((p_valor->>'hasP12') = 'true')
      or nullif(p_valor->>'p12Base64Enc', '') is not null,
    'hasPin',
      ((p_valor->>'hasPin') = 'true')
      or nullif(p_valor->>'pinEnc', '') is not null,
    'identificacion', p_valor->'identificacion',
    'razonSocial', p_valor->'razonSocial',
    'sucursal', coalesce(nullif(p_valor->>'sucursal', ''), '001'),
    'terminal', coalesce(nullif(p_valor->>'terminal', ''), '00001'),
    'tipoIdentificacion', coalesce(nullif(p_valor->>'tipoIdentificacion', ''), '02')
  );
$$;

revoke all on function public.redact_fiscal_config(jsonb) from public;

create or replace function public.obtener_configuracion_empresa(p_clave text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_empresa_id uuid := public.current_empresa_id();
  v_clave text := nullif(btrim(coalesce(p_clave, '')), '');
  v_valor jsonb := '{}'::jsonb;
begin
  if v_user_id is null or v_empresa_id is null then
    raise exception 'Usuario autenticado requerido.' using errcode = '28000';
  end if;

  if v_clave is null then
    raise exception 'Clave de configuracion requerida.' using errcode = '22023';
  end if;

  if v_clave = 'fiscal' then
    return public.obtener_configuracion_fiscal();
  end if;

  if v_clave <> 'notifications'
    and not (
      public.current_user_has_permission('admin.settings.view')
      or public.current_user_has_permission('admin.settings.manage')
    ) then
    raise exception 'Permiso admin.settings.view requerido.' using errcode = '42501';
  end if;

  select coalesce(ce.valor, '{}'::jsonb)
    into v_valor
  from public.configuraciones_empresa as ce
  where ce.empresa_id = v_empresa_id
    and ce.clave = v_clave;

  return coalesce(v_valor, '{}'::jsonb);
end;
$$;

create or replace function public.guardar_configuracion_empresa(
  p_clave text,
  p_valor jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_empresa_id uuid := public.current_empresa_id();
  v_clave text := nullif(btrim(coalesce(p_clave, '')), '');
  v_valor jsonb := coalesce(p_valor, '{}'::jsonb);
begin
  if v_user_id is null or v_empresa_id is null then
    raise exception 'Usuario autenticado requerido.' using errcode = '28000';
  end if;

  if v_clave is null then
    raise exception 'Clave de configuracion requerida.' using errcode = '22023';
  end if;

  if v_clave = 'fiscal' then
    raise exception 'Use guardar_configuracion_fiscal para fiscal.' using errcode = '22023';
  end if;

  if not public.current_user_has_permission('admin.settings.manage') then
    raise exception 'Permiso admin.settings.manage requerido.' using errcode = '42501';
  end if;

  insert into public.configuraciones_empresa (empresa_id, clave, valor)
  values (v_empresa_id, v_clave, v_valor)
  on conflict on constraint configuraciones_empresa_clave_unique
  do update set
    valor = excluded.valor,
    updated_at = now()
  returning valor into v_valor;

  return coalesce(v_valor, '{}'::jsonb);
end;
$$;

create or replace function public.obtener_configuracion_fiscal()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_empresa_id uuid := public.current_empresa_id();
  v_valor jsonb := '{}'::jsonb;
begin
  if v_user_id is null or v_empresa_id is null then
    raise exception 'Usuario autenticado requerido.' using errcode = '28000';
  end if;

  if not (
    public.current_user_has_permission('admin.settings.view')
    or public.current_user_has_permission('admin.settings.manage')
    or public.current_user_has_permission('billing.fiscal.view')
    or public.current_user_has_permission('billing.fiscal.manage')
  ) then
    raise exception 'Permiso fiscal requerido.' using errcode = '42501';
  end if;

  select coalesce(ce.valor, '{}'::jsonb)
    into v_valor
  from public.configuraciones_empresa as ce
  where ce.empresa_id = v_empresa_id
    and ce.clave = 'fiscal';

  return public.redact_fiscal_config(coalesce(v_valor, '{}'::jsonb));
end;
$$;

create or replace function public.guardar_configuracion_fiscal(p_valor jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_empresa_id uuid := public.current_empresa_id();
  v_existing jsonb := '{}'::jsonb;
  v_input jsonb := coalesce(p_valor, '{}'::jsonb);
  v_public jsonb := '{}'::jsonb;
  v_secret_patch jsonb := '{}'::jsonb;
  v_merged jsonb := '{}'::jsonb;
begin
  if v_user_id is null or v_empresa_id is null then
    raise exception 'Usuario autenticado requerido.' using errcode = '28000';
  end if;

  if not (
    public.current_user_has_permission('admin.settings.manage')
    or public.current_user_has_permission('billing.fiscal.manage')
  ) then
    raise exception 'Permiso billing.fiscal.manage requerido.' using errcode = '42501';
  end if;

  select coalesce(ce.valor, '{}'::jsonb)
    into v_existing
  from public.configuraciones_empresa as ce
  where ce.empresa_id = v_empresa_id
    and ce.clave = 'fiscal';

  v_public :=
    v_input
    - 'haciendaPassword'
    - 'haciendaUsuario'
    - 'p12Base64'
    - 'pin'
    - 'haciendaPasswordEnc'
    - 'haciendaUsuarioEnc'
    - 'p12Base64Enc'
    - 'pinEnc'
    - 'hasHaciendaPassword'
    - 'hasHaciendaUsuario'
    - 'hasP12'
    - 'hasPin';

  if nullif(v_input->>'haciendaPasswordEnc', '') is not null then
    v_secret_patch := v_secret_patch || jsonb_build_object('haciendaPasswordEnc', v_input->>'haciendaPasswordEnc');
  end if;

  if nullif(v_input->>'haciendaUsuarioEnc', '') is not null then
    v_secret_patch := v_secret_patch || jsonb_build_object('haciendaUsuarioEnc', v_input->>'haciendaUsuarioEnc');
  end if;

  if nullif(v_input->>'p12Base64Enc', '') is not null then
    v_secret_patch := v_secret_patch || jsonb_build_object('p12Base64Enc', v_input->>'p12Base64Enc');
  end if;

  if nullif(v_input->>'pinEnc', '') is not null then
    v_secret_patch := v_secret_patch || jsonb_build_object('pinEnc', v_input->>'pinEnc');
  end if;

  v_merged := coalesce(v_existing, '{}'::jsonb) || v_public || v_secret_patch;
  v_merged := v_merged || jsonb_build_object(
    'hasHaciendaPassword', nullif(v_merged->>'haciendaPasswordEnc', '') is not null,
    'hasHaciendaUsuario', nullif(v_merged->>'haciendaUsuarioEnc', '') is not null,
    'hasP12', nullif(v_merged->>'p12Base64Enc', '') is not null,
    'hasPin', nullif(v_merged->>'pinEnc', '') is not null
  );

  insert into public.configuraciones_empresa (empresa_id, clave, valor)
  values (v_empresa_id, 'fiscal', v_merged)
  on conflict on constraint configuraciones_empresa_clave_unique
  do update set
    valor = excluded.valor,
    updated_at = now()
  returning valor into v_merged;

  insert into public.auditoria_eventos (
    empresa_id,
    usuario_id,
    entidad,
    accion,
    datos_antes,
    datos_despues
  )
  values (
    v_empresa_id,
    v_user_id,
    'configuraciones_empresa',
    'guardar_configuracion_fiscal',
    public.redact_fiscal_config(coalesce(v_existing, '{}'::jsonb)),
    public.redact_fiscal_config(coalesce(v_merged, '{}'::jsonb))
  );

  return public.redact_fiscal_config(coalesce(v_merged, '{}'::jsonb));
end;
$$;

revoke all on function public.obtener_configuracion_empresa(text) from public;
revoke all on function public.guardar_configuracion_empresa(text, jsonb) from public;
revoke all on function public.obtener_configuracion_fiscal() from public;
revoke all on function public.guardar_configuracion_fiscal(jsonb) from public;

grant execute on function public.obtener_configuracion_empresa(text) to authenticated;
grant execute on function public.guardar_configuracion_empresa(text, jsonb) to authenticated;
grant execute on function public.obtener_configuracion_fiscal() to authenticated;
grant execute on function public.guardar_configuracion_fiscal(jsonb) to authenticated;
