# Personal E Invitaciones

biz.os usa el flujo operativo "Agregar personal" para sumar colaboradores a una
empresa existente sin crear usuarios manuales ni contrasenas temporales desde el
panel administrativo.

## Flujo Del Dueno Inicial

El primer usuario entra por `/signup`, crea su cuenta con Supabase Auth y luego
usa `/onboarding`. La RPC `bootstrap_empresa_inicial` crea la empresa, sucursal
principal, rol administrador, profile, modulos, plan y configuracion inicial.

Ese usuario queda como administrador principal de la empresa. El frontend no
crea `profile` directamente y no envia `empresa_id`.

## Agregar Personal

Un admin con `admin.users.manage` entra a `/admin/invitaciones` o
`/rrhh/personal/nuevo` y completa:

- nombre completo
- cedula / identificacion
- telefono
- correo
- rol
- sucursal
- cargo / puesto opcional

Al guardar, el frontend llama la RPC `crear_invitacion_usuario`. La empresa se
resuelve server-side con `current_empresa_id()`. La invitacion queda pendiente y
se muestra un link para copiar si no hay proveedor de correo real configurado.

El select de roles prioriza los roles estandar del tenant: `Super Admin`, `Administrador`,
`Supervisor`, `Vendedor`, `Servicio al cliente`, `Bodeguero`,
`Chofer / Repartidor`, `Contabilidad / Facturacion`, `RRHH` y luego roles
personalizados.

La migracion local `database/migrations/0026_personal_invitations_flow.sql`
agrega `cedula`, `telefono` y `cargo` a `invitaciones_usuarios` y endurece las
validaciones de creacion y aceptacion. No debe ejecutarse automaticamente.

## Invitado Sin Cuenta

El invitado abre `/invitation?token=...`. Si no tiene sesion, la pantalla muestra
"Crear cuenta para aceptar invitacion" y lo lleva a
`/signup?invitation_token=...`.

El invitado crea su propia contrasena con Supabase Auth. Si Supabase requiere
confirmacion de correo, debe confirmar y luego iniciar sesion; biz.os conserva
el token en la cookie httpOnly `bizos_pending_invitation_token` y vuelve a
`/invitation?token=...`.

## Invitado Con Cuenta Sin Profile

Si el invitado ya tiene cuenta Auth pero no tiene `profile`, inicia sesion con el
mismo correo invitado y acepta la invitacion. La RPC `aceptar_invitacion_usuario`
crea el `profile` con empresa, rol y sucursal definidos por el admin.

## Cuenta Que Ya Tiene Empresa

Un usuario que ya tiene `profile` no puede aceptar otra invitacion. El sistema
muestra un mensaje humano y pide usar otro correo. El modelo actual asume un
usuario operativo en una sola empresa.

## Registro Publico

`PUBLIC_SIGNUP_ENABLED` controla el registro libre:

- sin variable o `PUBLIC_SIGNUP_ENABLED=true`: permite `/signup` y
  `/onboarding` para crear una empresa nueva.
- `PUBLIC_SIGNUP_ENABLED=false`: bloquea signup sin invitacion y muestra
  "El registro publico no esta disponible. Solicita una invitacion."

Signup con `invitation_token` sigue permitido aunque el registro publico este
cerrado. Si existe `bizos_pending_invitation_token`, `/onboarding` redirige a
`/invitation` y no permite crear una empresa por error.

## Seguridad

- No se usa `SUPABASE_SERVICE_ROLE_KEY`.
- El frontend no envia `empresa_id`.
- `profiles.id` sigue siendo `auth.users.id`.
- `current_empresa_id()` sigue siendo la fuente tenant server-side/RLS.
- El admin no ve ni maneja contrasenas.
- No se generan contrasenas temporales.
- La contrasena la crea el invitado con Supabase Auth.
- No se acepta invitacion con correo distinto al JWT autenticado.
- No se permite que una cuenta con `profile` acepte otra empresa.
- Rol y sucursal se validan server-side contra la empresa actual.
