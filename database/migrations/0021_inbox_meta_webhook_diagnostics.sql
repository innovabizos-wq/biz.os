-- biz.os Meta webhook diagnostics hardening.
-- Apply manually in Supabase SQL Editor after 0019_inbox_meta_webhooks.sql.
-- This replaces only the processing RPC so every JSON POST leaves a safe trace.

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
  v_content text;
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
        limit 1;

        for v_status in select * from jsonb_array_elements(coalesce(v_value->'statuses', '[]'::jsonb))
        loop
          v_event_count := v_event_count + 1;
          v_message_id := v_status->>'id';
          v_recipient_id := coalesce(v_status->>'recipient_id', v_account_id);
          v_type := 'status';

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
            v_type,
            v_message_id,
            concat_ws(':', v_channel, v_account_id, v_recipient_id),
            null,
            v_recipient_id,
            jsonb_build_object(
              'object', v_object,
              'entry_id', v_entry->>'id',
              'phone_number_id', v_account_id,
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
          v_type := coalesce(v_message->>'type', 'texto');
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
            v_type,
            v_message_id,
            v_external_conversation_id,
            v_sender_id,
            v_recipient_id,
            jsonb_build_object(
              'object', v_object,
              'entry_id', v_entry->>'id',
              'phone_number_id', v_account_id,
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
          order by ic.created_at desc
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
              prioridad
            )
            values (
              v_canal.empresa_id,
              v_canal.id,
              v_channel,
              v_value#>>'{contacts,0,profile,name}',
              v_sender_id,
              v_sender_id,
              'abierta',
              'normal'
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
            case
              when v_type = 'image' then 'imagen'
              when v_type = 'audio' then 'audio'
              when v_type = 'video' then 'video'
              when v_type = 'document' then 'documento'
              else 'texto'
            end,
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
            'webhook_meta_mensaje',
            'Mensaje entrante recibido por webhook Meta.',
            jsonb_build_object('webhook_evento_id', v_event.id, 'message_id', v_message_id)
          );

          update public.inbox_webhook_eventos as e
          set procesado = true,
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
          v_type,
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
        order by ic.created_at desc
        limit 1;

        if v_conversation.id is null then
          insert into public.inbox_conversaciones (
            empresa_id,
            canal_id,
            canal,
            contacto_identificador,
            contacto_usuario,
            estado,
            prioridad
          )
          values (
            v_canal.empresa_id,
            v_canal.id,
            v_channel,
            v_sender_id,
            v_sender_id,
            'abierta',
            'normal'
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
          'webhook_meta_mensaje',
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
