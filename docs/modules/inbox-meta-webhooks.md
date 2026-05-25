# Inbox Meta webhooks

Esta fase implementa el endpoint base para webhooks oficiales de Meta en Inbox.

## Incluye

- `GET /api/webhooks/meta` para verificacion con `hub.challenge`.
- `POST /api/webhooks/meta` para recibir payloads entrantes.
- Normalizacion basica de WhatsApp, Facebook Messenger e Instagram Messaging.
- Guardado de eventos en `inbox_webhook_eventos`.
- Creacion o actualizacion de conversaciones Inbox.
- Guardado de mensajes entrantes.
- Dedupe por `canal_message_id`.

## No incluye

- Envio real de mensajes.
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

## Limitaciones

- Los payloads reales pueden requerir ajustes por canal y tipo de evento.
- Los adjuntos se guardan como resumen textual.
- No se envia ninguna respuesta real.

## Proximos pasos

- Envio oficial.
- Plantillas WhatsApp.
- Estados delivered/read.
- Adjuntos.
- IA asistida.
