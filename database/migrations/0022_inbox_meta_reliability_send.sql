-- biz.os Meta Inbox reliability and manual WhatsApp sending.
-- Apply manually in Supabase SQL Editor after 0021_inbox_meta_webhook_diagnostics.sql.
-- This migration does not delete duplicate channels and does not send messages automatically.

create or replace function public.procesar_inbox_webhook_meta(
  p_payload jsonb,
  p_headers jsonb default '{}'::jsonb
)
returns table (
  eventos_recibidos integer,
  mensajes_creados integer,
  conversaciones_creadas integer,
  mensajes_duplicados integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payload jsonb := coalesce(p_payload, '{}'::jsonb);
  v_safe_payload jsonb;
  v_object text := coalesce(v_payload->>'object', 'meta');
  v_entry jsonb;
  v_change jsonb;
  v_value jsonb;
  v_message jsonb;
  v_status jsonb;
  v_messaging jsonb;
  v_event public.inbox_webhook_eventos%rowtype;
  v_canal public.inbox_canales%rowtype;
  v_conversation public.inbox_conversaciones%rowtype;
  v_channel text;
  v_account_id text;
  v_sender_id text;
  v_recipient_id text;
  v_message_id text;
  v_external_conversation_id text;
  v_text text;
  v_type text;
  v_message_type text;
  v_content text;
  v_contact_name text;
  v_timestamp timestamptz;
  v_event_count integer := 0;
  v_messages_created integer := 0;
  v_conversations_created integer := 0;
  v_duplicates integer := 0;
begin
  v_safe_payload := v_payload - 'access_token' - 'app_secret' - 'verify_token';

  for v_entry in select * from jsonb_array_elements(coalesce(v_payload->'entry', '[]'::jsonb))
  loop
    if v_object = 'whatsapp_business_account' then
      for v_change in select * from jsonb_array_elements(coalesce(v_entry->'changes', '[]'::jsonb))
      loop
        v_value := coalesce(v_change->'value', '{}'::jsonb);
        v_account_id := coalesce(v_value#>>'{metadata,phone_number_id}', v_entry->>'id');
        v_channel := 'whatsapp';
        v_canal := null;

        select c.* into v_canal
        from public.inbox_canales as c
        where c.proveedor = 'meta'
          and c.canal = v_channel
          and c.estado <> 'inactivo'
          and (
            c.configuracion_publica->>'phone_number_id' = v_account_id
            or c.configuracion_publica->>'waba_id' = v_entry->>'id'
            or c.identificador_externo = v_account_id
          )
        order by
          (c.estado = 'activo') desc,
          (c.conexion_estado = 'configurado') desc,
          c.updated_at desc
        limit 1;

        for v_status in select * from jsonb_array_elements(coalesce(v_value->'statuses', '[]'::jsonb))
        loop
          v_event_count := v_event_count + 1;
          v_message_id := v_status->>'id';
          v_recipient_id := coalesce(v_status->>'recipient_id', v_account_id);

          insert into public.inbox_webhook_eventos (
            empresa_id,
            canal_id,
            proveedor,
            canal,
            object_type,
            event_type,
            external_message_id,
            external_conversation_id,
            external_sender_id,
            external_recipient_id,
            payload,
            procesado,
            error,
            processed_at
          )
          values (
            v_canal.empresa_id,
            v_canal.id,
            'meta',
            v_channel,
            v_object,
            'status',
            v_message_id,
            concat_ws(':', v_channel, v_account_id, v_recipient_id),
            null,
            v_recipient_id,
            jsonb_build_object(
              'object', v_object,
              'entry_id', v_entry->>'id',
              'phone_number_id', v_account_id,
              'display_phone_number', v_value#>>'{metadata,display_phone_number}',
              'status', v_status - 'access_token' - 'app_secret' - 'verify_token'
            ),
            v_canal.id is not null,
            case
              when v_canal.id is null then 'No se pudo asociar evento Meta a un canal configurado'
              else null
            end,
            now()
          );
        end loop;

        for v_message in select * from jsonb_array_elements(coalesce(v_value->'messages', '[]'::jsonb))
        loop
          v_event_count := v_event_count + 1;
          v_sender_id := v_message->>'from';
          v_recipient_id := v_account_id;
          v_message_id := v_message->>'id';
          v_external_conversation_id := concat_ws(':', v_channel, v_account_id, v_sender_id);
          v_type := coalesce(v_message->>'type', 'text');
          v_message_type := case
            when v_type = 'image' then 'imagen'
            when v_type = 'audio' then 'audio'
            when v_type = 'video' then 'video'
            when v_type = 'document' then 'documento'
            else 'texto'
          end;
          v_text := v_message#>>'{text,body}';
          v_content := coalesce(
            nullif(v_text, ''),
            case
              when v_type = 'image' then '[imagen]'
              when v_type = 'audio' then '[audio]'
              when v_type = 'video' then '[video]'
              when v_type = 'document' then '[documento]'
              else '[' || v_type || ']'
            end
          );
          v_contact_name := v_value#>>'{contacts,0,profile,name}';
          v_timestamp := case
            when v_message ? 'timestamp'
            then to_timestamp((v_message->>'timestamp')::double precision)
            else now()
          end;

          insert into public.inbox_webhook_eventos (
            empresa_id,
            canal_id,
            proveedor,
            canal,
            object_type,
            event_type,
            external_message_id,
            external_conversation_id,
            external_sender_id,
            external_recipient_id,
            payload
          )
          values (
            v_canal.empresa_id,
            v_canal.id,
            'meta',
            v_channel,
            v_object,
            'message',
            v_message_id,
            v_external_conversation_id,
            v_sender_id,
            v_recipient_id,
            jsonb_build_object(
              'object', v_object,
              'entry_id', v_entry->>'id',
              'phone_number_id', v_account_id,
              'display_phone_number', v_value#>>'{metadata,display_phone_number}',
              'message_type', v_type,
              'message', v_message - 'access_token' - 'app_secret' - 'verify_token'
            )
          )
          returning * into v_event;

          if v_canal.id is null then
            update public.inbox_webhook_eventos as e
            set error = 'No se pudo asociar evento Meta a un canal configurado',
                processed_at = now()
            where e.id = v_event.id;
            continue;
          end if;

          if v_message_id is not null and exists (
            select 1
            from public.inbox_mensajes as im
            where im.empresa_id = v_canal.empresa_id
              and im.canal_message_id = v_message_id
          ) then
            v_duplicates := v_duplicates + 1;
            update public.inbox_webhook_eventos as e
            set procesado = true,
                error = null,
                processed_at = now()
            where e.id = v_event.id;
            continue;
          end if;

          select ic.* into v_conversation
          from public.inbox_conversaciones as ic
          where ic.empresa_id = v_canal.empresa_id
            and ic.canal_id = v_canal.id
            and ic.contacto_identificador = v_sender_id
            and ic.estado <> 'spam'
          order by
            (ic.estado in ('abierta', 'pendiente')) desc,
            ic.updated_at desc
          limit 1;

          if v_conversation.id is null then
            insert into public.inbox_conversaciones (
              empresa_id,
              canal_id,
              canal,
              contacto_nombre,
              contacto_identificador,
              contacto_telefono,
              estado,
              prioridad,
              ultimo_mensaje,
              ultimo_mensaje_at
            )
            values (
              v_canal.empresa_id,
              v_canal.id,
              v_channel,
              v_contact_name,
              v_sender_id,
              v_sender_id,
              'abierta',
              'normal',
              v_content,
              v_timestamp
            )
            returning * into v_conversation;
            v_conversations_created := v_conversations_created + 1;
          end if;

          insert into public.inbox_mensajes (
            empresa_id,
            conversacion_id,
            direccion,
            tipo,
            contenido,
            estado,
            canal_message_id,
            es_nota_interna,
            received_at
          )
          values (
            v_canal.empresa_id,
            v_conversation.id,
            'entrante',
            v_message_type,
            v_content,
            'registrado',
            v_message_id,
            false,
            v_timestamp
          );

          update public.inbox_conversaciones as ic
          set contacto_nombre = coalesce(ic.contacto_nombre, v_contact_name),
              contacto_telefono = coalesce(ic.contacto_telefono, v_sender_id),
              ultimo_mensaje = v_content,
              ultimo_mensaje_at = v_timestamp,
              updated_at = now()
          where ic.id = v_conversation.id
            and ic.empresa_id = v_canal.empresa_id;

          insert into public.inbox_eventos (
            empresa_id,
            conversacion_id,
            tipo,
            descripcion,
            metadata
          )
          values (
            v_canal.empresa_id,
            v_conversation.id,
            'mensaje_entrante_meta',
            'Mensaje entrante recibido por webhook Meta.',
            jsonb_build_object(
              'webhook_evento_id', v_event.id,
              'message_id', v_message_id,
              'phone_number_id', v_account_id
            )
          );

          update public.inbox_webhook_eventos as e
          set procesado = true,
              error = null,
              processed_at = now()
          where e.id = v_event.id;

          v_messages_created := v_messages_created + 1;
        end loop;

        if jsonb_array_length(coalesce(v_value->'messages', '[]'::jsonb)) = 0
          and jsonb_array_length(coalesce(v_value->'statuses', '[]'::jsonb)) = 0 then
          v_event_count := v_event_count + 1;
          insert into public.inbox_webhook_eventos (
            empresa_id,
            canal_id,
            proveedor,
            canal,
            object_type,
            event_type,
            external_recipient_id,
            payload,
            procesado,
            error,
            processed_at
          )
          values (
            v_canal.empresa_id,
            v_canal.id,
            'meta',
            v_channel,
            v_object,
            coalesce(v_change->>'field', 'sin_mensajes'),
            v_account_id,
            jsonb_build_object(
              'object', v_object,
              'entry_id', v_entry->>'id',
              'phone_number_id', v_account_id,
              'value', v_value - 'access_token' - 'app_secret' - 'verify_token'
            ),
            v_canal.id is not null,
            case
              when v_canal.id is null then 'No se pudo asociar evento Meta a un canal configurado'
              else null
            end,
            now()
          );
        end if;
      end loop;
    elsif v_object in ('page', 'instagram') then
      for v_messaging in select * from jsonb_array_elements(coalesce(v_entry->'messaging', '[]'::jsonb))
      loop
        v_event_count := v_event_count + 1;
        v_channel := case when v_object = 'instagram' then 'instagram' else 'facebook' end;
        v_sender_id := v_messaging#>>'{sender,id}';
        v_recipient_id := v_messaging#>>'{recipient,id}';
        v_account_id := coalesce(v_recipient_id, v_entry->>'id');
        v_message_id := coalesce(v_messaging#>>'{message,mid}', v_messaging->>'mid');
        v_external_conversation_id := concat_ws(':', v_channel, v_account_id, v_sender_id);
        v_text := v_messaging#>>'{message,text}';
        v_type := case when v_text is not null then 'texto' else 'sistema' end;
        v_content := coalesce(nullif(v_text, ''), '[evento de mensajeria]');
        v_timestamp := case
          when v_messaging ? 'timestamp'
          then to_timestamp((v_messaging->>'timestamp')::double precision / 1000)
          else now()
        end;
        v_canal := null;

        select c.* into v_canal
        from public.inbox_canales as c
        where c.proveedor = 'meta'
          and c.canal = v_channel
          and c.estado <> 'inactivo'
          and (
            c.configuracion_publica->>'page_id' = v_account_id
            or c.configuracion_publica->>'instagram_business_account_id' = v_account_id
            or c.identificador_externo = v_account_id
          )
        order by
          (c.estado = 'activo') desc,
          (c.conexion_estado = 'configurado') desc,
          c.updated_at desc
        limit 1;

        insert into public.inbox_webhook_eventos (
          empresa_id,
          canal_id,
          proveedor,
          canal,
          object_type,
          event_type,
          external_message_id,
          external_conversation_id,
          external_sender_id,
          external_recipient_id,
          payload
        )
        values (
          v_canal.empresa_id,
          v_canal.id,
          'meta',
          v_channel,
          v_object,
          case when v_message_id is null then 'event' else 'message' end,
          v_message_id,
          v_external_conversation_id,
          v_sender_id,
          v_recipient_id,
          jsonb_build_object(
            'object', v_object,
            'entry_id', v_entry->>'id',
            'messaging', v_messaging - 'access_token' - 'app_secret' - 'verify_token'
          )
        )
        returning * into v_event;

        if v_canal.id is null then
          update public.inbox_webhook_eventos as e
          set error = 'No se pudo asociar evento Meta a un canal configurado',
              processed_at = now()
          where e.id = v_event.id;
          continue;
        end if;

        if v_message_id is null then
          update public.inbox_webhook_eventos as e
          set procesado = true,
              processed_at = now()
          where e.id = v_event.id;
          continue;
        end if;

        if exists (
          select 1
          from public.inbox_mensajes as im
          where im.empresa_id = v_canal.empresa_id
            and im.canal_message_id = v_message_id
        ) then
          v_duplicates := v_duplicates + 1;
          update public.inbox_webhook_eventos as e
          set procesado = true,
              processed_at = now()
          where e.id = v_event.id;
          continue;
        end if;

        select ic.* into v_conversation
        from public.inbox_conversaciones as ic
        where ic.empresa_id = v_canal.empresa_id
          and ic.canal_id = v_canal.id
          and ic.contacto_identificador = v_sender_id
          and ic.estado <> 'spam'
        order by
          (ic.estado in ('abierta', 'pendiente')) desc,
          ic.updated_at desc
        limit 1;

        if v_conversation.id is null then
          insert into public.inbox_conversaciones (
            empresa_id,
            canal_id,
            canal,
            contacto_identificador,
            contacto_usuario,
            estado,
            prioridad,
            ultimo_mensaje,
            ultimo_mensaje_at
          )
          values (
            v_canal.empresa_id,
            v_canal.id,
            v_channel,
            v_sender_id,
            v_sender_id,
            'abierta',
            'normal',
            v_content,
            v_timestamp
          )
          returning * into v_conversation;
          v_conversations_created := v_conversations_created + 1;
        end if;

        insert into public.inbox_mensajes (
          empresa_id,
          conversacion_id,
          direccion,
          tipo,
          contenido,
          estado,
          canal_message_id,
          es_nota_interna,
          received_at
        )
        values (
          v_canal.empresa_id,
          v_conversation.id,
          'entrante',
          v_type,
          v_content,
          'registrado',
          v_message_id,
          false,
          v_timestamp
        );

        update public.inbox_conversaciones as ic
        set ultimo_mensaje = v_content,
            ultimo_mensaje_at = v_timestamp,
            updated_at = now()
        where ic.id = v_conversation.id
          and ic.empresa_id = v_canal.empresa_id;

        insert into public.inbox_eventos (
          empresa_id,
          conversacion_id,
          tipo,
          descripcion,
          metadata
        )
        values (
          v_canal.empresa_id,
          v_conversation.id,
          'mensaje_entrante_meta',
          'Mensaje entrante recibido por webhook Meta.',
          jsonb_build_object('webhook_evento_id', v_event.id, 'message_id', v_message_id)
        );

        update public.inbox_webhook_eventos as e
        set procesado = true,
            processed_at = now()
        where e.id = v_event.id;

        v_messages_created := v_messages_created + 1;
      end loop;
    end if;
  end loop;

  if v_event_count = 0 then
    v_event_count := 1;
    insert into public.inbox_webhook_eventos (
      proveedor,
      object_type,
      event_type,
      payload,
      procesado,
      error,
      processed_at
    )
    values (
      'meta',
      v_object,
      'payload_no_soportado',
      v_safe_payload,
      false,
      'No se pudo asociar evento Meta a un canal configurado',
      now()
    );
  end if;

  return query
  select v_event_count, v_messages_created, v_conversations_created, v_duplicates;
end;
$$;

revoke all on function public.procesar_inbox_webhook_meta(jsonb, jsonb) from public;
grant execute on function public.procesar_inbox_webhook_meta(jsonb, jsonb) to anon, authenticated;

create or replace function public.obtener_inbox_whatsapp_send_config(
  p_conversacion_id uuid
)
returns table (
  conversacion_id uuid,
  empresa_id uuid,
  canal_id uuid,
  phone_number_id text,
  to_phone text,
  access_token text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_empresa_id uuid := public.current_empresa_id();
  v_conversacion public.inbox_conversaciones%rowtype;
  v_canal public.inbox_canales%rowtype;
  v_secretos public.inbox_canal_secretos%rowtype;
  v_phone_number_id text;
  v_to_phone text;
begin
  if v_user_id is null or v_empresa_id is null then
    raise exception 'Usuario autenticado requerido.' using errcode = '28000';
  end if;

  if not public.current_user_has_permission('inbox.conversations.reply') then
    raise exception 'Permiso inbox.conversations.reply requerido.' using errcode = '42501';
  end if;

  select c.* into v_conversacion
  from public.inbox_conversaciones as c
  where c.id = p_conversacion_id
    and c.empresa_id = v_empresa_id;

  if v_conversacion.id is null then
    raise exception 'Conversacion no encontrada.' using errcode = 'P0002';
  end if;

  select c.* into v_canal
  from public.inbox_canales as c
  where c.id = v_conversacion.canal_id
    and c.empresa_id = v_empresa_id
    and c.proveedor = 'meta'
    and c.canal = 'whatsapp'
    and c.estado = 'activo'
    and c.conexion_estado = 'configurado';

  if v_canal.id is null then
    raise exception 'Canal WhatsApp Meta no configurado.' using errcode = 'P0002';
  end if;

  select s.* into v_secretos
  from public.inbox_canal_secretos as s
  where s.canal_id = v_canal.id
    and s.empresa_id = v_empresa_id;

  v_phone_number_id := nullif(btrim(coalesce(v_canal.configuracion_publica->>'phone_number_id', v_canal.identificador_externo, '')), '');
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

  if v_phone_number_id is null then
    raise exception 'phone_number_id no configurado.' using errcode = '22023';
  end if;

  if v_secretos.access_token is null or nullif(btrim(v_secretos.access_token), '') is null then
    raise exception 'access_token no configurado.' using errcode = '22023';
  end if;

  if v_to_phone is null or length(v_to_phone) < 8 then
    raise exception 'Destinatario WhatsApp invalido.' using errcode = '22023';
  end if;

  return query
  select
    v_conversacion.id,
    v_empresa_id,
    v_canal.id,
    v_phone_number_id,
    v_to_phone,
    v_secretos.access_token;
end;
$$;

revoke all on function public.obtener_inbox_whatsapp_send_config(uuid) from public;
grant execute on function public.obtener_inbox_whatsapp_send_config(uuid) to authenticated;

create or replace function public.registrar_inbox_mensaje_saliente_meta(
  p_conversacion_id uuid,
  p_contenido text,
  p_canal_message_id text default null,
  p_estado text default 'enviado',
  p_error text default null
)
returns setof public.inbox_mensajes
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_empresa_id uuid := public.current_empresa_id();
  v_conversacion public.inbox_conversaciones%rowtype;
  v_mensaje public.inbox_mensajes%rowtype;
  v_estado text := coalesce(nullif(btrim(p_estado), ''), 'enviado');
  v_contenido text := nullif(btrim(coalesce(p_contenido, '')), '');
begin
  if v_user_id is null or v_empresa_id is null then
    raise exception 'Usuario autenticado requerido.' using errcode = '28000';
  end if;

  if not public.current_user_has_permission('inbox.conversations.reply') then
    raise exception 'Permiso inbox.conversations.reply requerido.' using errcode = '42501';
  end if;

  if v_estado not in ('enviado', 'fallido') then
    raise exception 'Estado de mensaje invalido.' using errcode = '22023';
  end if;

  if v_contenido is null then
    raise exception 'Contenido de mensaje requerido.' using errcode = '22023';
  end if;

  select c.* into v_conversacion
  from public.inbox_conversaciones as c
  where c.id = p_conversacion_id
    and c.empresa_id = v_empresa_id;

  if v_conversacion.id is null then
    raise exception 'Conversacion no encontrada.' using errcode = 'P0002';
  end if;

  insert into public.inbox_mensajes (
    empresa_id,
    conversacion_id,
    direccion,
    tipo,
    contenido,
    estado,
    canal_message_id,
    es_nota_interna,
    enviado_por,
    sent_at
  )
  values (
    v_empresa_id,
    v_conversacion.id,
    'saliente',
    'texto',
    v_contenido,
    v_estado,
    nullif(btrim(coalesce(p_canal_message_id, '')), ''),
    false,
    v_user_id,
    now()
  )
  returning * into v_mensaje;

  update public.inbox_conversaciones as ic
  set ultimo_mensaje = v_contenido,
      ultimo_mensaje_at = now(),
      updated_by = v_user_id,
      updated_at = now()
  where ic.id = v_conversacion.id
    and ic.empresa_id = v_empresa_id;

  insert into public.inbox_eventos (
    empresa_id,
    conversacion_id,
    tipo,
    descripcion,
    metadata,
    created_by
  )
  values (
    v_empresa_id,
    v_conversacion.id,
    'mensaje_saliente_whatsapp',
    case
      when v_estado = 'enviado' then 'Mensaje saliente enviado manualmente por WhatsApp.'
      else 'Intento de mensaje saliente por WhatsApp fallido.'
    end,
    jsonb_build_object(
      'message_id', nullif(btrim(coalesce(p_canal_message_id, '')), ''),
      'estado', v_estado,
      'error', nullif(btrim(coalesce(p_error, '')), '')
    ),
    v_user_id
  );

  return next v_mensaje;
end;
$$;

revoke all on function public.registrar_inbox_mensaje_saliente_meta(uuid, text, text, text, text) from public;
grant execute on function public.registrar_inbox_mensaje_saliente_meta(uuid, text, text, text, text) to authenticated;

create or replace function public.obtener_inbox_webhook_eventos_no_asociados(
  p_canal_id uuid,
  p_limit integer default 10
)
returns table (
  id uuid,
  canal_id uuid,
  canal text,
  object_type text,
  event_type text,
  external_message_id text,
  external_sender_id text,
  external_recipient_id text,
  procesado boolean,
  error text,
  received_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_empresa_id uuid := public.current_empresa_id();
  v_canal public.inbox_canales%rowtype;
  v_limit integer := least(greatest(coalesce(p_limit, 10), 1), 50);
  v_identifiers text[];
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

  select c.* into v_canal
  from public.inbox_canales as c
  where c.id = p_canal_id
    and c.empresa_id = v_empresa_id;

  if v_canal.id is null then
    raise exception 'Canal no encontrado.' using errcode = 'P0002';
  end if;

  v_identifiers := array_remove(array[
    nullif(v_canal.configuracion_publica->>'phone_number_id', ''),
    nullif(v_canal.configuracion_publica->>'waba_id', ''),
    nullif(v_canal.configuracion_publica->>'page_id', ''),
    nullif(v_canal.configuracion_publica->>'instagram_business_account_id', ''),
    nullif(v_canal.identificador_externo, '')
  ], null);

  return query
  select
    e.id,
    e.canal_id,
    e.canal,
    e.object_type,
    e.event_type,
    e.external_message_id,
    e.external_sender_id,
    e.external_recipient_id,
    e.procesado,
    e.error,
    e.received_at
  from public.inbox_webhook_eventos as e
  where e.proveedor = 'meta'
    and (
      e.canal_id is null
      or e.error is not null
    )
    and (
      e.empresa_id = v_empresa_id
      or e.empresa_id is null
    )
    and (
      cardinality(v_identifiers) = 0
      or e.external_recipient_id = any(v_identifiers)
      or e.external_sender_id = any(v_identifiers)
    )
  order by e.received_at desc
  limit v_limit;
end;
$$;

revoke all on function public.obtener_inbox_webhook_eventos_no_asociados(uuid, integer) from public;
grant execute on function public.obtener_inbox_webhook_eventos_no_asociados(uuid, integer) to authenticated;
