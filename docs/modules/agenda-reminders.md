# Recordatorios de Agenda

Los seguimientos de CRM generan recordatorios aunque nadie tenga Biz.OS abierto. Vercel invoca `GET /api/notifications/reminders/run` cada minuto y la ruta exige `Authorization: Bearer CRON_SECRET`. Una operación manual usa `POST` con `REMINDER_WORKER_SECRET` o el encabezado `x-reminder-worker-secret`.

La base selecciona únicamente empresas activas, seguimientos pendientes y responsables activos. Cada empresa conserva su anticipación configurada entre 1 y 1440 minutos. El trabajo procesa hasta 500 seguimientos por ejecución de cron y admite un máximo explícito de 1000.

`followup_reminder_deliveries` reserva cada recordatorio por empresa, seguimiento, responsable, tipo y fecha programada antes de crear la notificación. Dos ejecuciones simultáneas o repetidas producen una sola notificación. Si el seguimiento cambia de fecha o de responsable, la nueva combinación puede generar el recordatorio correspondiente.

La consulta interactiva de notificaciones usa la misma operación de base limitada al usuario autenticado. Esta ruta requiere `crm.followups.view`; la operación general solo se concede a `service_role`. La tabla de control tiene RLS y no concede acceso directo a `anon` ni a `authenticated`.

Variables necesarias en producción:

- `CRON_SECRET`: secreto enviado automáticamente por Vercel Cron.
- `REMINDER_WORKER_SECRET`: secreto distinto para ejecuciones manuales del operador.

La respuesta del trabajo informa cuántos seguimientos revisó, cuántas notificaciones creó y cuántos recordatorios ya existían. Los errores devuelven `503` y quedan registrados por la aplicación para investigación.
