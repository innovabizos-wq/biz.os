# Inbox Meta webhooks

Esta fase implementa el endpoint base para webhooks oficiales de Meta en Inbox.

## Incluye

- `GET /api/webhooks/meta` para verificacion con `hub.challenge`.
- `POST /api/webhooks/meta` para recibir payloads entrantes.
- Normalizacion basica de WhatsApp, Facebook Messenger e Instagram Messaging.
- Registro diagnostico de payloads con mensajes, estados o eventos sin mensaje.
- Limite de payload para evitar cuerpos excesivos.
- Guardado de eventos en `inbox_webhook_eventos`.
- Creacion o actualizacion de conversaciones Inbox.
- Guardado de mensajes entrantes.
- Dedupe por `canal_message_id`.

## No incluye

- Respuestas automaticas.
- Plantillas de WhatsApp.
- OAuth o Embedded Signup.
- Bots, IA o respuestas automaticas.
- Adjuntos completos.

## Verify token

Meta llama el endpoint con:

```text
GET /api/webhooks/meta?hub.mode=subscribe&hub.verify_token=...&hub.challenge=...
```

El endpoint busca el `verify_token` en canales Meta activos/configurados y
devuelve `hub.challenge` como texto plano si coincide. No devuelve ni imprime el
token.

## Callback URL

Usar:

```text
${NEXT_PUBLIC_APP_URL}/api/webhooks/meta
```

Si `NEXT_PUBLIC_APP_URL` no esta configurado, la UI muestra `/api/webhooks/meta`.

## Firma

`POST` valida `X-Hub-Signature-256` mediante una RPC `SECURITY DEFINER` que
compara el HMAC contra `app_secret` sin exponerlo al endpoint. En desarrollo se
puede usar:

```text
META_WEBHOOK_SKIP_SIGNATURE=true
```

Solo funciona cuando `NODE_ENV !== "production"`.

## Eventos procesados

El endpoint llama el procesador para todo payload JSON de Meta. La RPC deja una
traza segura en `inbox_webhook_eventos` aunque el evento no se pueda asociar a
un canal o aunque sea un estado sin mensaje:

- WhatsApp: `object = whatsapp_business_account` con `value.messages[]`.
- WhatsApp status: `value.statuses[]`, se registra como `event_type = status`
  y no crea conversacion.
- Messenger: `object = page` con `entry[].messaging[].message.mid`.
- Instagram: `object = instagram` con `entry[].messaging[].message.mid`.

Mensajes entrantes crean o actualizan conversaciones. Eventos de estado,
lecturas, entregas, echoes o payloads sin `message.mid` no crean mensajes Inbox,
pero quedan visibles en diagnostico.

## Prueba GET

```bash
curl "https://tu-dominio.com/api/webhooks/meta?hub.mode=subscribe&hub.verify_token=TU_VERIFY_TOKEN&hub.challenge=12345"
```

Debe responder:

```text
12345
```

## Prueba POST simulada

Con `META_WEBHOOK_SKIP_SIGNATURE=true` en desarrollo:

```bash
curl -X POST "http://localhost:3000/api/webhooks/meta" \
  -H "Content-Type: application/json" \
  -d '{"object":"whatsapp_business_account","entry":[{"changes":[{"value":{"metadata":{"phone_number_id":"PHONE_NUMBER_ID"},"messages":[{"from":"50688880000","id":"wamid.TEST1","timestamp":"1716500000","type":"text","text":{"body":"Hola"}}]}}]}]}'
```

Luego revisar `/inbox/conversaciones`.

## Conversaciones y mensajes

El procesador busca el canal Meta por `phone_number_id`, `page_id`,
`instagram_business_account_id` o `identificador_externo`. Si no existe una
conversacion para el remitente externo, crea una nueva. Si el mensaje ya existe
por `canal_message_id`, lo marca como duplicado y no lo inserta otra vez.

## Envio manual WhatsApp

Desde una conversacion WhatsApp Meta configurada, el usuario con permiso
`inbox.conversations.reply` puede enviar texto real manualmente. El servidor
obtiene `phone_number_id` y `access_token` mediante RPC segura, llama Graph API
y registra el mensaje saliente como `enviado` o `fallido`. El token no se manda
al frontend.

La version de Graph API se controla con:

```text
META_GRAPH_API_VERSION=v25.0
```

## Limitaciones

- Los payloads reales pueden requerir ajustes por canal y tipo de evento.
- Los adjuntos se guardan como resumen textual.
- No hay respuestas automaticas, plantillas ni bot.
- En produccion la firma debe estar activa; no usar
  `META_WEBHOOK_SKIP_SIGNATURE=true`.

## Proximos pasos

- Plantillas WhatsApp y ventanas de conversacion.
- Estados delivered/read.
- Adjuntos.
- IA asistida.
