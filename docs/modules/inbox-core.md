# Inbox core

Inbox es el modulo base de chat unificado por empresa. Centraliza
conversaciones manuales, conversaciones originadas por canales Meta
configurados y la base para correo omnicanal.

## Incluye

- Canales manuales, correo preparado y canales Meta para WhatsApp, Facebook
  Messenger e Instagram DM.
- Webhook seguro de correo entrante para que un proveedor/relay registre emails
  como conversaciones y mensajes `entrante`.
- Conversaciones por empresa.
- Mensajes entrantes manuales o recibidos por webhook Meta.
- Respuestas salientes manuales; WhatsApp envia mensajes reales cuando el canal Meta esta activo y configurado.
- Lectura por agente para alimentar contadores de no leidos en Whapp.
- Senal SLA basica derivada del ultimo entrante no leido para priorizar
  conversaciones.
- Catalogo local de plantillas Meta y soporte de envio de plantilla aprobada
  para conversaciones WhatsApp Meta.
- Catalogo base de campanas Whapp con plantilla aprobada, programacion y
  metricas iniciales.
- Cola base de destinatarios por campana con opt-in obligatorio, estado,
  variables, errores y tracking por destinatario.
- Acciones operativas para preparar cola, pausar/cancelar campanas y
  excluir/restaurar destinatarios antes del envio real.
- Despacho controlado de campanas WhatsApp por lotes, con auditoria por
  destinatario y endpoint worker protegido por secreto.
- Cron productivo para despachar campanas WhatsApp en lotes pequenos usando el
  endpoint server-only.
- Reintentos controlados de destinatarios de campana con backoff y fallo
  definitivo al agotar intentos.
- Sincronizacion de webhooks Meta `status` contra destinatarios de campana por
  WAMID para actualizar entregado, leido y fallido.
- Conciliacion de respuestas entrantes contra destinatarios de campana por
  conversacion o telefono normalizado para actualizar `respondido`.
- Configuracion base de automatizaciones/autopilot con reglas auditables, sin
  motor automatico productivo.
- Evaluacion asistida de reglas autopilot en conversaciones Whapp con auditoria
  de sugerido/ejecutado/omitido.
- Contexto comercial Whapp para conversaciones vinculadas a CRM: cotizaciones,
  ventas y pipeline del cliente.
- IA contextual local para sugerir siguiente mejor accion sin proveedor externo.
- Notas internas.
- Asignacion de conversacion a usuarios activos de la empresa.
- Vinculacion de conversacion con clientes CRM existentes.
- Estados de conversacion: abierta, pendiente, cerrada y spam.
- RLS, permisos y RPCs sin aceptar `empresa_id` desde frontend.

## No incluye

- Meta Embedded Signup.
- Sincronizacion automatica de plantillas oficiales contra Meta.
- Conector productivo de correo IMAP/SMTP u OAuth administrado dentro de biz.os.
- Reglas SLA avanzadas por equipo, horario o prioridad.
- Limites por numero, pausas automaticas por calidad Meta y automatizaciones
  por eventos.
- Adjuntos, audio, imagenes o video.
- Motor de bots/automatizaciones en tiempo real e IA generativa con proveedor
  externo.

Los secretos Meta se guardan en tabla privada y se consultan solo desde servidor.
La ventana de 24 horas y plantillas oficiales son restricciones operativas de
Meta para envio avanzado; el envio manual WhatsApp disponible depende de que la
conversacion pertenezca a un canal WhatsApp Meta activo/configurado.

## Relacion con CRM

Una conversacion puede vincularse a un cliente existente en `crm_clientes`. Crear
clientes directamente desde la conversacion queda fuera de este modulo para
evitar duplicar logica de CRM y permisos.

## Permisos

- `inbox.conversations.view`: ver conversaciones y mensajes.
- `inbox.conversations.create`: crear conversaciones y registrar entrantes manuales.
- `inbox.conversations.reply`: registrar respuestas, notas internas y enviar WhatsApp real cuando aplica.
- `inbox.conversations.assign`: asignar usuarios y vincular clientes.
- `inbox.conversations.status.change`: cambiar estado de conversacion.
- `inbox.channels.view`: ver canales.
- `inbox.channels.manage`: crear canales y cambiar estado.

La migracion asigna estos permisos a roles de sistema existentes con
`roles.es_sistema = true` y `roles.nombre = 'Administrador'` o `Super Admin`.
En esta documentacion, `Super Admin` significa rol interno del tenant con acceso
total a su empresa; no significa Platform Admin/AInovaCR.

## Aplicacion manual

Aplicar manualmente `database/migrations/0016_inbox_core.sql` en Supabase SQL
Editor. No se debe ejecutar desde la aplicacion ni con
`SUPABASE_SERVICE_ROLE_KEY`.

## Prueba funcional

1. Ir a `/inbox/canales`.
2. Crear un canal manual o configurar un canal Meta.
3. Ir a `/inbox/conversaciones`.
4. Crear una conversacion manual.
5. Abrir el detalle de la conversacion.
6. Registrar un mensaje entrante manual o recibir uno desde el webhook Meta.
7. Registrar una respuesta saliente; en WhatsApp Meta configurado, enviarla por WhatsApp.
8. Agregar una nota interna.
9. Vincular un cliente CRM existente.
10. Asignar un usuario activo.
11. Cerrar la conversacion.

## Rutas

- `/inbox`
- `/inbox/conversaciones`
- `/inbox/conversaciones/[conversacionId]`
- `/inbox/canales`

## Extensiones

- Sincronizacion oficial de plantillas.
- Escalado del worker de campanas con limites por numero y ventanas de calidad.
- Motor de reglas Whapp por evento.
- Manejo avanzado de ventanas de atencion.
- IA asistida.
