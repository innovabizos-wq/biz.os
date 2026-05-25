-- biz.os Meta webhooks for Inbox.
-- Apply manually in Supabase SQL Editor after 0018_inbox_meta_channels.sql.
-- This phase verifies webhook setup and stores inbound events/messages only.
-- It does not send real messages.

create table public.inbox_webhook_eventos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid references public.empresas(id) on delete cascade,
  canal_id uuid references public.inbox_canales(id) on delete set null,
  proveedor text not null default 'meta',
  canal text,
  object_type text,
  event_type text,
  external_message_id text,
  external_conversation_id text,
  external_sender_id text,
  external_recipient_id text,
  payload jsonb not null default '{}'::jsonb,
  procesado boolean not null default false,
  error text,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

create index inbox_webhook_eventos_empresa_id_idx
  on public.inbox_webhook_eventos (empresa_id);
create index inbox_webhook_eventos_empresa_canal_idx
  on public.inbox_webhook_eventos (empresa_id, canal_id);
create index inbox_webhook_eventos_proveedor_idx
  on public.inbox_webhook_eventos (proveedor);
create index inbox_webhook_eventos_canal_idx
  on public.inbox_webhook_eventos (canal);
create index inbox_webhook_eventos_external_message_id_idx
  on public.inbox_webhook_eventos (external_message_id);
create index inbox_webhook_eventos_external_conversation_id_idx
  on public.inbox_webhook_eventos (external_conversation_id);
create index inbox_webhook_eventos_procesado_idx
  on public.inbox_webhook_eventos (procesado);
create index inbox_webhook_eventos_received_at_idx
  on public.inbox_webhook_eventos (received_at);

alter table public.inbox_webhook_eventos enable row level security;

grant select on public.inbox_webhook_eventos to authenticated;

create policy inbox_webhook_eventos_select_permission
on public.inbox_webhook_eventos
for select
to authenticated
using (
  empresa_id = public.current_empresa_id()
  and (
    public.current_user_has_permission('inbox.channels.manage')
    or public.current_user_has_permission('inbox.conversations.view')
  )
);

create or replace function public.buscar_canal_por_verify_token(
  p_verify_token text
)
returns table (
  canal_id uuid,
  empresa_id uuid,
  canal text
)
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
    on s.canal_id = c.id
   and s.empresa_id = c.empresa_id
  where c.proveedor = 'meta'
    and c.estado <> 'inactivo'
    and s.verify_token = p_verify_token
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
    select s.app_secret
    from public.inbox_canal_secretos as s
    join public.inbox_canales as c
      on c.id = s.canal_id
     and c.empresa_id = s.empresa_id
    where c.proveedor = 'meta'
      and c.estado <> 'inactivo'
      and s.app_secret is not null
  loop
    v_expected := 'sha256=' || encode(
      extensions.hmac(
        convert_to(p_payload, 'UTF8'),
        convert_to(v_secret, 'UTF8'),
        'sha256'
      ),
      'hex'
    );

    if lower(v_expected) = lower(p_signature) then
      return true;
    end if;
  end loop;

  return false;
end;
$$;

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

        select c.* into v_canal
        from public.inbox_canales as c
        where c.proveedor = 'meta'
          and c.canal = v_channel
          and c.estado <> 'inactivo'
          and (
            c.configuracion_publica->>'phone_number_id' = v_account_id
            or c.identificador_externo = v_account_id
          )
        limit 1;

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
            jsonb_build_object('object', v_object, 'entry', v_entry - 'access_token' - 'app_secret' - 'verify_token')
          )
          returning * into v_event;

          if v_canal.id is null then
            update public.inbox_webhook_eventos as e
            set error = 'Canal Meta no encontrado para payload.',
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
              when v_type in ('image', 'audio', 'video', 'document') then
                case
                  when v_type = 'image' then 'imagen'
                  when v_type = 'audio' then 'audio'
                  when v_type = 'video' then 'video'
                  else 'documento'
                end
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
          jsonb_build_object('object', v_object, 'entry', v_entry - 'access_token' - 'app_secret' - 'verify_token')
        )
        returning * into v_event;

        if v_canal.id is null then
          update public.inbox_webhook_eventos as e
          set error = 'Canal Meta no encontrado para payload.',
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
    insert into public.inbox_webhook_eventos (
      proveedor,
      object_type,
      event_type,
      payload,
      procesado,
      processed_at
    )
    values (
      'meta',
      v_object,
      'sin_mensajes',
      v_safe_payload,
      true,
      now()
    );
  end if;

  return query
  select v_event_count, v_messages_created, v_conversations_created, v_duplicates;
end;
$$;

revoke all on function public.buscar_canal_por_verify_token(text) from public;
revoke all on function public.verificar_meta_webhook_signature(text, text) from public;
revoke all on function public.procesar_inbox_webhook_meta(jsonb, jsonb) from public;

grant execute on function public.buscar_canal_por_verify_token(text) to anon, authenticated;
grant execute on function public.verificar_meta_webhook_signature(text, text) to anon, authenticated;
grant execute on function public.procesar_inbox_webhook_meta(jsonb, jsonb) to anon, authenticated;
