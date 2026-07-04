# Whapp Core Operativo

Whapp es el centro operativo omnicanal de biz.os. En esta fase se construye como
una capa sobre el Inbox actual para aprovechar canales Meta, correo preparado,
webhook, acciones, RLS, permisos y conversaciones existentes sin duplicar el
sistema.

Conceptualmente, Whapp debe operar como tecnologia provista por AInovaCR/biz.os,
similar a un proveedor tipo Callbell. El cliente usa un numero asignado para su
empresa; no se espera que consiga y administre por su cuenta las credenciales
tecnicas de Meta.

## Incluye En Esta Fase

- Rutas `/whapp`, `/whapp/conversaciones`, `/whapp/conversaciones/[conversacionId]`, `/whapp/canales`, `/whapp/canales/[canalId]`, `/whapp/plantillas`, `/whapp/campanas`, `/whapp/automatizaciones`, `/whapp/salud` y `/whapp/reportes`.
- Bandeja Whapp con filtros: Mios, Sin asignar, Todos, No leidos, Abiertas,
  Cerradas y canal.
- Identidad visual por canal para WhatsApp, Facebook Messenger, Instagram DM,
  correo y manual.
- Entrada de correo por webhook seguro para convertir emails recibidos por un
  proveedor/relay en conversaciones del visor Whapp.
- Lectura por agente con contador de no leidos por conversacion.
- SLA basico de primera respuesta con estados Al dia, En riesgo, Vencido y
  Pausado.
- Conversacion robusta con mensajes entrantes, salientes, notas internas, estado del mensaje y WAMID tecnico.
- Envio manual real por WhatsApp cuando la conversacion pertenece a canal Meta WhatsApp configurado.
- Catalogo local de plantillas Meta con categoria, idioma, estado y canal.
- Envio de plantillas aprobadas desde conversaciones WhatsApp Meta configuradas.
- Catalogo base de campanas WhatsApp con canal Meta, plantilla aprobada,
  audiencia prevista, programacion y metricas iniciales.
- Cola base de destinatarios por campana con opt-in obligatorio, estado por
  destinatario, variables, errores y tracking de envio/entrega/lectura/respuesta.
- Control operativo de campanas: preparar cola, pausar, reabrir, cancelar,
  excluir/restaurar destinatarios y recalcular metricas desde la cola.
- Despacho controlado de campanas por lotes: accion manual desde UI y endpoint
  server-only protegido por secreto para cron/worker.
- Despacho automatico de recuperacion por Vercel Cron diario usando el mismo
  worker server-only y lotes pequenos compatibles con Hobby.
- Reintentos controlados de campanas con backoff: 3 intentos maximos por
  destinatario antes de marcarlo como `fallido`.
- Sincronizacion de estados Meta por webhook hacia destinatarios de campana:
  enviado, entregado, leido y fallido por `canal_message_id`.
- Conciliacion automatica de respuestas entrantes contra destinatarios de
  campana por conversacion o telefono normalizado, con estado `respondido` y
  recalculo de metricas.
- Configuracion base de reglas de autopilot con disparador, condiciones, modo,
  accion preparada y auditoria de ejecuciones futuras.
- Autopilot asistido por conversacion: evalua reglas activas contra el chat y
  permite auditar sugerencias, ejecuciones u omisiones.
- Respuesta simulada para canales no listos, correo saliente preparado o manuales.
- Panel de cliente, asignacion, vinculo CRM, acciones rapidas y auditoria.
- Panel comercial por conversacion con historial de cotizaciones, ventas,
  pipeline abierto, vendido historico y accesos directos a CRM/ventas.
- Panel de IA contextual por conversacion con recomendaciones locales basadas
  en SLA, mensajes, historial comercial y contexto del negocio.
- Salud del canal con configuracion publica, secretos en modo configurado/no configurado, ultimos eventos webhook asociados y no asociados.
- Advertencia de canales WhatsApp Meta duplicados por `phone_number_id`.
- Migracion local para vinculo CRM basico por telefono y actualizacion de estados Meta.

## No Incluye Todavia

- Motor de ejecucion automatica por eventos.
- Generacion IA con proveedor LLM externo y streaming.
- Sincronizacion automatica de aprobacion de plantillas contra Meta.
- Conector de correo productivo IMAP/SMTP u OAuth administrado dentro de biz.os.
- Bloqueo estricto de ventana 24h.
- Push, sonido o SLA avanzado configurable por equipo/horario.
- Deduplicacion pesada de clientes.

## Probar Recepcion

1. Platform Admin provisiona el numero/canal y configura Meta.
2. Platform Admin configura el webhook hacia `NEXT_PUBLIC_APP_URL + /api/webhooks/meta`.
3. Platform Admin suscribe el objeto de WhatsApp a `messages`.
4. Confirmar que el canal tenga `phone_number_id`, `waba_id`, `app_id`, `access_token`, `app_secret` y `verify_token`.
5. Enviar un WhatsApp real al numero asignado del canal.
6. Revisar `/whapp/salud` o `/whapp/canales/[canalId]`.
7. Confirmar que el evento aparece como asociado y procesado.
8. Revisar `/whapp/conversaciones` y abrir la conversacion creada o actualizada.

## Probar Envio

1. Abrir una conversacion WhatsApp asociada a canal Meta activo/configurado.
2. Escribir en la caja de respuesta.
3. Presionar `Enviar por WhatsApp`.
4. Confirmar que el mensaje queda saliente con estado `enviado` o `fallido`.
5. Si Meta devuelve WAMID, se guarda como `canal_message_id`.

La ventana de 24 horas se muestra como advertencia visual. El bloqueo estricto y
la seleccion obligatoria de plantillas fuera de ventana quedan para la fase de
control estricto. Las plantillas aprobadas ya pueden registrarse localmente y
enviarse desde conversaciones WhatsApp Meta configuradas.

## Plantillas Meta

La ruta `/whapp/plantillas` permite registrar plantillas aprobadas, pendientes,
rechazadas o en borrador. El envio desde una conversacion solo permite
plantillas con estado `aprobada`.

El catalogo local no sustituye la aprobacion oficial en Meta. Platform
Admin/AInovaCR debe crear o validar la plantilla en Meta y mantener el estado
local alineado hasta que exista sincronizacion automatica.

## Campanas WhatsApp

La ruta `/whapp/campanas` permite crear campanas operativas ligadas a un canal
WhatsApp Meta activo/configurado y a una plantilla con estado `aprobada`.
Registra objetivo, audiencia prevista, fecha programada, estado y metricas base:
destinatarios, enviados, entregados, leidos, respuestas y fallos.

Tambien permite cargar destinatarios manualmente con opt-in obligatorio,
telefono normalizado, origen de consentimiento, variables por contacto y estado
de cola. Cada destinatario conserva tracking de envio, entrega, lectura,
respuesta y ultimo error para que la campana sea auditable antes de automatizar
el despacho.

El operador puede preparar la cola de una campana editable. Esa accion mueve
destinatarios `listo` a `en_cola`, cambia la campana a `enviando` y recalcula
metricas desde los destinatarios. Tambien puede pausar, reabrir o cancelar la
campana, y excluir/restaurar destinatarios antes de que tengan tracking real de
envio.

Cuando una campana esta `enviando`, Whapp puede despachar un lote manual desde
la UI. El despachador usa `service_role` solo en servidor, obtiene el token Meta
mediante el RPC `obtener_inbox_whatsapp_campaign_send_config_server`, envia la
plantilla aprobada a destinatarios `en_cola` con opt-in y guarda
`canal_message_id`, intentos, ultimo error y `sent_at`.

Los webhooks de estado de Meta se sincronizan automaticamente contra
`inbox_campana_destinatarios` usando el `canal_message_id`/WAMID. El trigger
`sync_inbox_campaign_recipient_status_from_webhook` actualiza `sent_at`,
`delivered_at`, `read_at`, `last_error` y recalcula metricas de la campana. Si
ya no quedan destinatarios `en_cola`, la campana pasa a `enviada`.

Cuando entra una respuesta del cliente en `inbox_mensajes`, el trigger
`sync_inbox_campaign_recipient_reply_from_message` busca el destinatario mas
reciente de la misma campana/canal por conversacion o telefono normalizado. Si
estaba `enviado`, `entregado` o `leido`, lo marca como `respondido`, guarda
`replied_at`, vincula la conversacion cuando faltaba y recalcula metricas.

El mismo despachador esta disponible en `POST /api/whapp/campanas/despachar`
para worker externo y en `GET /api/whapp/campanas/despachar` para Vercel Cron.
El `POST` exige `Authorization: Bearer WHAPP_CAMPAIGN_WORKER_SECRET` o header
`x-whapp-worker-secret`. El `GET` acepta `Authorization: Bearer CRON_SECRET`
para cron productivo. Ambos aceptan `limit`, `campaignId` y `empresaId` como
query params. El lote maximo se limita a 10 para evitar picos accidentales.

`vercel.json` ejecuta `GET /api/whapp/campanas/despachar` una vez al dia a las
06:00 UTC (`0 6 * * *`) para ser compatible con Vercel Hobby. El cron es solo
respaldo/reintento: procesa destinatarios `inbox_campana_destinatarios` en
`en_cola` con `opt_in=true`, valida que la campana este `enviando`, llama a
`dispatchInboxCampaignBatch` y actualiza destinatarios a `enviado`, `fallido` o
de vuelta a `en_cola` para reintento con backoff. El endpoint registra logs
`[whapp-campaign-dispatcher]` con revisados, actualizados, enviados, fallidos,
reintentos y omitidos.

El despacho inmediato no depende del cron: el mismo despachador esta disponible
por `POST /api/whapp/campanas/despachar` con `WHAPP_CAMPAIGN_WORKER_SECRET`, y
la UI de campanas permite despachar lotes cuando la campana esta `enviando`.
Esto requiere configurar `CRON_SECRET` en Vercel para el `GET` diario.

El despachador no marca todo error temporal como fallo definitivo. Si Meta o la
configuracion responden con error, el destinatario queda en `en_cola` para
reintento con backoff de 5 y 30 minutos. Al tercer intento fallido pasa a
`fallido`, conserva `last_error`, `attempt_count` y `last_attempt_at`, y las
metricas se recalculan.

Todavia faltan limites avanzados por numero, pausas automaticas por calidad
Meta, ventanas de atribucion configurables y panel avanzado de entregabilidad.

## Automatizaciones Y Autopilot

La ruta `/whapp/automatizaciones` permite registrar reglas de autopilot por
empresa. Cada regla define:

- Canal opcional o todos los canales.
- Disparador: conversacion creada, mensaje entrante, palabra clave, SLA en
  riesgo o SLA vencido.
- Accion preparada: crear sugerencia, agregar nota, asignar usuario, cambiar
  estado o enviar plantilla.
- Modo: sugerida, asistida o automatica.
- Estado: activa, inactiva o pausada.
- Condiciones y configuracion de accion en texto simple o JSON.

El detalle de conversacion evalua reglas activas contra el canal, ultimo mensaje
entrante, palabras clave y SLA. El agente puede marcar una regla como sugerida,
ejecutada u omitida, quedando registrada en la auditoria de ejecuciones.

Esta fase no ejecuta acciones automaticamente. Deja el modelo multiempresa, RLS,
UI, evaluacion asistida y auditoria para encender el motor de eventos con
controles de seguridad, limites, pruebas y supervision.

## Correo Entrante

Whapp acepta correo entrante mediante `POST /api/whapp/email/inbound` para
integrarse con un proveedor o relay externo. El endpoint exige `Authorization:
Bearer WHAPP_EMAIL_INBOUND_SECRET` o header `x-whapp-email-secret`, valida que
el canal pertenezca a la empresa, sea `email`, proveedor `email` y este activo,
y deduplica por `externalMessageId`.

Payload minimo:

```json
{
  "empresaId": "uuid",
  "canalId": "uuid",
  "externalMessageId": "provider-message-id",
  "fromEmail": "cliente@example.com",
  "subject": "Consulta",
  "text": "Mensaje recibido"
}
```

Si `threadId` viene informado, Whapp lo usa como identificador de conversacion;
si no, usa el correo del remitente. El mensaje queda como `entrante` en
`inbox_mensajes`, visible con badge de correo, no leidos, SLA y paneles de
contexto igual que el resto de canales. El envio saliente real por SMTP/OAuth
sigue pendiente.

## Integracion CRM Y Ventas

Cuando una conversacion tiene cliente CRM vinculado, Whapp muestra un panel
comercial dentro del detalle de conversacion con:

- Ultimas cotizaciones del cliente.
- Ultimas ventas del cliente.
- Cantidad de cotizaciones, cotizaciones abiertas y ventas.
- Valor de pipeline abierto y vendido historico.
- Enlaces a CRM, cotizaciones y ventas.

Esto permite que el agente responda, cotice, venda y de seguimiento desde el
chat sin perder contexto comercial. La creacion guiada de cotizacion desde la
conversacion y las recomendaciones automaticas quedan para la fase de IA/acciones
asistidas.

## IA Contextual

El detalle de conversacion incluye un panel de IA contextual local. Este panel
no envia datos a un proveedor externo todavia; genera recomendaciones
deterministicas y auditables usando:

- Estado y SLA de la conversacion.
- Ultimo mensaje entrante.
- Cotizaciones abiertas o vencidas.
- Ventas activas.
- Historial comercial del cliente.
- Contexto del negocio cuando el usuario tiene permiso para verlo.

El objetivo es que el agente vea la siguiente mejor accion antes de responder.
La conexion a un proveedor LLM debe respetar la configuracion de `/admin/ia`,
limites de uso, auditoria `ai_usage_events`, privacidad de datos y reglas del
contexto del negocio.

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

Estos requisitos son responsabilidad tecnica de Platform Admin/AInovaCR, no del
Tenant Owner como tarea normal de onboarding.

- `phone_number_id`.
- `waba_id`.
- `access_token`.
- `app_secret`.
- `verify_token`.
- Webhook URL publico.
- Suscripcion a `messages`.

Los secretos no se muestran completos ni se envian al frontend; solo se exponen
banderas de configuracion.

Para piloto y venta simple se debe preferir un numero nuevo apto para Meta. No
prometer uso de numeros existentes ya registrados en WhatsApp/WhatsApp Business
sin proceso de liberacion o migracion compatible con Meta.
