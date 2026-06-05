# Whapp Core Operativo

Whapp es el centro operativo WhatsApp de biz.os. En esta fase se construye como
una capa sobre el Inbox actual para aprovechar canales Meta, webhook, acciones,
RLS, permisos y conversaciones existentes sin duplicar el sistema.

## Incluye En Esta Fase

- Rutas `/whapp`, `/whapp/conversaciones`, `/whapp/conversaciones/[conversacionId]`, `/whapp/canales`, `/whapp/canales/[canalId]`, `/whapp/salud` y `/whapp/reportes`.
- Bandeja Whapp con filtros: Mios, Sin asignar, Todos, No leidos, Abiertas y Cerradas.
- Conversacion robusta con mensajes entrantes, salientes, notas internas, estado del mensaje y WAMID tecnico.
- Envio manual real por WhatsApp cuando la conversacion pertenece a canal Meta WhatsApp configurado.
- Respuesta simulada para canales no listos o manuales.
- Panel de cliente, asignacion, vinculo CRM, acciones rapidas y auditoria.
- Salud del canal con configuracion publica, secretos en modo configurado/no configurado, ultimos eventos webhook asociados y no asociados.
- Advertencia de canales WhatsApp Meta duplicados por `phone_number_id`.
- Migracion local para vinculo CRM basico por telefono y actualizacion de estados Meta.

## No Incluye Todavia

- Campanas.
- Automatizaciones.
- IA.
- Plantillas Meta.
- Bloqueo estricto de ventana 24h.
- Push, sonido o SLA avanzado.
- Deduplicacion pesada de clientes.

## Probar Recepcion

1. En Meta, configurar el webhook hacia `NEXT_PUBLIC_APP_URL + /api/webhooks/meta`.
2. Suscribir el objeto de WhatsApp a `messages`.
3. Confirmar que el canal tenga `phone_number_id`, `waba_id`, `app_id`, `access_token`, `app_secret` y `verify_token`.
4. Enviar un WhatsApp real al numero del canal.
5. Revisar `/whapp/salud` o `/whapp/canales/[canalId]`.
6. Confirmar que el evento aparece como asociado y procesado.
7. Revisar `/whapp/conversaciones` y abrir la conversacion creada o actualizada.

## Probar Envio

1. Abrir una conversacion WhatsApp asociada a canal Meta activo/configurado.
2. Escribir en la caja de respuesta.
3. Presionar `Enviar por WhatsApp`.
4. Confirmar que el mensaje queda saliente con estado `enviado` o `fallido`.
5. Si Meta devuelve WAMID, se guarda como `canal_message_id`.

La ventana de 24 horas se muestra como advertencia visual. El bloqueo estricto y
plantillas oficiales quedan para la fase de templates.

## Leer Salud Del Canal

La salud muestra:

- Canal activo/inactivo.
- Conexion configurada/pendiente/error.
- `phone_number_id`.
- `waba_id`.
- `app_id`.
- Access token, app secret y verify token como configurado/no configurado.
- Ultimo POST recibido.
- Ultimo mensaje procesado.
- Ultimo error webhook.
- Eventos asociados y no asociados con `received_at`, `event_type`, IDs externos, procesado y error.

Si hay POST no asociado, normalmente el `phone_number_id` recibido no coincide
con el canal configurado. Si solo hay eventos `status`, Meta esta reportando
estados pero aun no mensajes entrantes.

## Requisitos Meta

- `phone_number_id`.
- `waba_id`.
- `access_token`.
- `app_secret`.
- `verify_token`.
- Webhook URL publico.
- Suscripcion a `messages`.

Los secretos no se muestran completos ni se envian al frontend; solo se exponen
banderas de configuracion.
