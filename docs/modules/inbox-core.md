# Inbox core

Esta fase crea el módulo base de Inbox / Chat unificado para conversaciones simuladas o manuales por empresa.

## Incluye

- Canales manuales o simulados para WhatsApp, Facebook Messenger, Instagram DM y manual.
- Conversaciones por empresa.
- Mensajes entrantes simulados.
- Respuestas salientes simuladas.
- Notas internas.
- Asignación de conversación a usuarios activos de la empresa.
- Vinculación de conversación con clientes CRM existentes.
- Estados de conversación: abierta, pendiente, cerrada y spam.
- RLS, permisos y RPCs sin aceptar `empresa_id` desde frontend.

## No incluye todavía

- Webhooks reales.
- Envío real por WhatsApp, Facebook Messenger o Instagram DM.
- Tokens de Meta.
- Meta Embedded Signup.
- Plantillas oficiales.
- Ventanas de 24 horas.
- Adjuntos, audio, imágenes o video.
- IA, bots o automatizaciones.

La integración real con Meta queda fuera de esta fase para mantener el aislamiento multiempresa, validar el modelo operativo interno y evitar guardar credenciales antes de tener el flujo oficial completo.

## Relación con CRM

Una conversación puede vincularse a un cliente existente en `crm_clientes`. Crear clientes directamente desde la conversación queda documentado como fase posterior para evitar duplicar lógica de CRM y permisos.

## Permisos

- `inbox.conversations.view`: ver conversaciones y mensajes.
- `inbox.conversations.create`: crear conversaciones y registrar entrantes simulados.
- `inbox.conversations.reply`: registrar respuestas simuladas y notas internas.
- `inbox.conversations.assign`: asignar usuarios y vincular clientes.
- `inbox.conversations.status.change`: cambiar estado de conversación.
- `inbox.channels.view`: ver canales.
- `inbox.channels.manage`: crear canales y cambiar estado.

La migración asigna estos permisos solo a roles de sistema existentes con `roles.es_sistema = true` y `roles.nombre = 'Administrador'`.

## Aplicación manual

Aplicar manualmente `database/migrations/0016_inbox_core.sql` en Supabase SQL Editor. No se debe ejecutar desde la aplicación ni con `SUPABASE_SERVICE_ROLE_KEY`.

## Prueba funcional

1. Ir a `/inbox/canales`.
2. Crear un canal manual o simulado.
3. Ir a `/inbox/conversaciones`.
4. Crear una conversación manual.
5. Abrir el detalle de la conversación.
6. Registrar un mensaje entrante simulado.
7. Registrar una respuesta saliente simulada.
8. Agregar una nota interna.
9. Vincular un cliente CRM existente.
10. Asignar un usuario activo.
11. Cerrar la conversación.

## Rutas

- `/inbox`
- `/inbox/conversaciones`
- `/inbox/conversaciones/[conversacionId]`
- `/inbox/canales`

## Próximos pasos

- Configuración oficial de Meta.
- Webhooks.
- Envío real.
- Plantillas oficiales.
- Manejo de ventanas de atención.
- IA asistida.
