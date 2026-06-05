# Notificaciones Por Usuario

Este modulo agrega notificaciones persistentes por usuario dentro de cada
empresa. No son mensajes globales: cada registro pertenece a `empresa_id` y a
un `recipient_profile_id` especifico.

## Incluye

- Tabla `user_notifications`.
- RLS para que cada usuario lea y marque solo sus propias notificaciones.
- RPCs seguras para crear, listar, contar y marcar notificaciones.
- Campana global en el layout interno.
- Contador de no leidas con `99+`.
- Punto visual y animacion breve cuando aumenta el contador.
- Supabase Realtime opcional para reaccionar al insertar notificaciones si la tabla esta publicada.
- Polling suave cada 5 segundos mientras la pestana esta visible como fallback.
- Zumbido opcional con Web Audio API y vibracion del dispositivo cuando el navegador lo permite.
- Panel con las ultimas notificaciones.
- Integracion inicial con el flujo Nueva consulta.
- Recordatorios persistentes para seguimientos antes y a la hora programada.

## No Incluye Todavia

- Push notifications del navegador.
- WebSockets.
- Supabase Realtime.
- Emails.
- Panel administrativo de notificaciones.
- Push nativo si la app esta cerrada.
- Reglas automaticas avanzadas por modulo.

## Seguridad

La aplicacion no acepta `empresa_id` desde frontend. Las RPCs resuelven la
empresa actual con `current_empresa_id()` y el usuario actual con `auth.uid()`.

`crear_notificacion_propia` crea notificaciones solo para el usuario actual.
`crear_notificacion_usuario` permite crear notificaciones a otro usuario de la
misma empresa solamente si quien ejecuta tiene `admin.users.manage`.

No se usa `SUPABASE_SERVICE_ROLE_KEY`.

## RPCs

- `crear_notificacion_usuario`
- `crear_notificacion_propia`
- `obtener_mis_notificaciones`
- `contar_mis_notificaciones_no_leidas`
- `marcar_notificacion_leida`
- `marcar_todas_mis_notificaciones_leidas`

## Campana Global

La campana vive en:

```text
src/app/(app)/layout.tsx
```

Muestra las ultimas notificaciones del usuario autenticado, el contador de no
leidas y permite marcar una o todas como leidas. Abrir el panel no marca todo
como leido; tocar una notificacion o su accion `Ver` marca solo ese registro.

Mientras biz.os esta abierto, la campana intenta escuchar inserts en
`user_notifications` por Supabase Realtime y tambien consulta
`/api/notifications/poll` cada 5 segundos si la pestana esta visible. El
endpoint tambien crea recordatorios pendientes de seguimientos para el usuario
actual antes de devolver la lista.

El zumbido se guarda como preferencia local del navegador. Si el navegador
bloquea audio o el dispositivo no soporta vibracion, la interfaz sigue
funcionando sin mostrar error tecnico.

## Integracion Con Nueva Consulta

Cuando se guarda una gestion desde Nueva consulta, se crea una notificacion:

```text
type: success
title: Gestion guardada
message: La gestion se guardo correctamente.
href: /crm/clientes/[clienteId]
entity_type: crm_customer
entity_id: clienteId
```

La gestion se sigue guardando como interaccion CRM. El flujo se cierra y vuelve
al Dashboard.

## Integracion Con Seguimientos

Cuando se crea un seguimiento CRM con usuario asignado, se crea una
notificacion persistente para ese usuario:

```text
type: task
title: Nuevo seguimiento asignado
href: /agenda/seguimientos
entity_type: crm_followup
```

Esto ocurre al crear/asignar el seguimiento.

Ademas, el polling crea dos recordatorios persistentes si el seguimiento sigue
pendiente:

```text
reminderKind: before_due
title: Seguimiento proximo
```

```text
reminderKind: due_now
title: Seguimiento pendiente ahora
```

El aviso previo usa la configuracion de empresa en Admin -> Apariencia ->
Notificaciones. El valor por defecto es 30 minutos. Sin cron global, si el
usuario tiene biz.os cerrado, el recordatorio se crea cuando vuelva a entrar o
cuando el polling vuelva a correr.

Para comportamiento realmente instantaneo, habilitar Realtime para la tabla
`user_notifications` en Supabase. Si no se habilita, el fallback de polling
mantiene la campana actualizada con una latencia aproximada de hasta 5 segundos.

## Aplicacion Manual

Aplicar manualmente en Supabase SQL Editor:

```text
database/migrations/0020_user_notifications.sql
```

La numeracion usa `0020` porque `0018` ya existe en este repositorio.

## Prueba

1. Aplicar la migracion manualmente.
2. Iniciar sesion.
3. Abrir `/dashboard`.
4. Verificar la campana global.
5. Crear una Nueva consulta con el boton flotante.
6. Guardar una gestion.
7. Confirmar que vuelve al Dashboard.
8. Abrir la campana y revisar la notificacion.
9. Abrir la notificacion para navegar al cliente.
10. Probar marcar todas como leidas.
11. Crear un seguimiento asignado al usuario actual para los proximos 30 minutos.
12. Confirmar que la campana zumba y muestra `Seguimiento proximo`.
13. Dejar un seguimiento vencido pendiente y confirmar `Seguimiento pendiente ahora`.
14. Confirmar que varios ciclos de polling no duplican recordatorios.
