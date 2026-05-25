# Notificaciones Por Usuario

Este modulo agrega notificaciones persistentes por usuario dentro de cada
empresa. No son mensajes globales: cada registro pertenece a `empresa_id` y a
un `recipient_profile_id` especifico.

## Incluye

- Tabla `user_notifications`.
- RLS para que cada usuario lea y marque solo sus propias notificaciones.
- RPCs seguras para crear, listar, contar y marcar notificaciones.
- Campana global en el layout interno.
- Contador de no leidas.
- Panel con las ultimas notificaciones.
- Integracion inicial con el flujo Nueva consulta.

## No Incluye Todavia

- Push notifications del navegador.
- WebSockets.
- Supabase Realtime.
- Emails.
- Panel administrativo de notificaciones.
- Preferencias por usuario.
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
leidas y permite marcar una o todas como leidas.

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
