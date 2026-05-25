# Invitaciones De Usuarios

biz.os usa invitaciones para agregar usuarios a una empresa sin crear usuarios
manuales ni contrasenas temporales desde el panel.

## SQL

La migracion local `database/migrations/0003_invitaciones_usuarios.sql` crea:

- tabla `invitaciones_usuarios`
- helper `current_user_has_permission(permission_code)`
- RPC `crear_invitacion_usuario`
- RPC `aceptar_invitacion_usuario`
- RLS de lectura administrativa

Debe aplicarse manualmente en Supabase SQL Editor despues de `0001` y `0002`.

## Crear Invitacion

Un administrador con `admin.users.manage` crea una invitacion indicando correo,
nombre, rol y sucursal opcional. La RPC resuelve la empresa desde `auth.uid()` y
`profiles`; nunca recibe `empresa_id` desde frontend.

La RPC valida que el rol y la sucursal pertenezcan a la empresa actual, genera un
token seguro y deja la invitacion pendiente por 7 dias.

## Aceptar Invitacion

El invitado abre `/invitation?token=...`, inicia sesion o crea cuenta con el
mismo correo de la invitacion y acepta. La RPC valida:

- usuario autenticado
- que no tenga `profile`
- token pendiente y no expirado
- correo del JWT igual al correo invitado

Luego crea el `profile` dentro de la empresa de la invitacion y marca la
invitacion como aceptada.

## Diferencia Con Onboarding

`/onboarding` crea una empresa nueva. Solo debe usarse para usuarios que llegan
sin invitacion y necesitan dar de alta su propia empresa.

`/invitation?token=...` acepta una invitacion para entrar a una empresa
existente. Si el invitado no esta autenticado, la pantalla envia a:

- `/signup?invitation_token=...`
- `/login?invitation_token=...`

Ese token solo conserva el flujo de navegacion. No define `empresa_id` ni otorga
acceso por si mismo; la RPC `aceptar_invitacion_usuario` valida el token, el
correo autenticado y que el usuario no tenga `profile`.

biz.os guarda temporalmente el token en una cookie httpOnly llamada
`bizos_pending_invitation_token`. La cookie solo conserva contexto de navegacion
por hasta 7 dias; no contiene `empresa_id` ni concede acceso.

Si Supabase requiere confirmacion de correo, el invitado debe confirmar su
correo y luego iniciar sesion. biz.os recupera el token pendiente y vuelve a
`/invitation?token=...` en lugar de enviarlo a `/onboarding`.

Cuando la invitacion se acepta correctamente, la cookie pendiente se elimina.

## Seguridad

No se usa `SUPABASE_SERVICE_ROLE_KEY`, no se acepta `empresa_id`, no hay bypass
por superadmin y no se abren inserts directos para usuarios normales. Las
mutaciones pasan por RPCs controladas.

## Pendientes

- Envio real de email.
- Cancelar invitacion.
- Reenviar invitacion.
- Expiracion automatica programada.
- Edicion de roles y permisos.
