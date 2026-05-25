# Bootstrap Inicial De Empresa

`bootstrap_empresa_inicial` es una RPC controlada para crear el primer ecosistema
de una empresa cuando un usuario autenticado todavia no tiene `profile`.

## Que Crea

- `empresas`: empresa inicial.
- `sucursales`: `Sucursal Principal` con codigo `principal`.
- `roles`: rol `Administrador` de la empresa.
- `rol_permisos`: todos los permisos activos del catalogo para ese rol inicial.
- `profiles`: profile operativo vinculado a `auth.uid()`.
- `empresa_modulos`: modulos iniciales `admin`, `crm` y `reports`.
- `empresa_plan`: plan `starter`.
- `configuraciones_empresa`: configuracion `general`.
- `auditoria_eventos`: evento `bootstrap_empresa_inicial`.

## Seguridad

La RPC no acepta `empresa_id`. La empresa se crea dentro de la funcion y el
profile se vincula siempre a `auth.uid()`.

La funcion impide duplicar bootstrap si ya existe un `profile` para el usuario
autenticado. No usa `service_role`, no usa `empresa_id = null` y no mezcla
superadmin dentro de `profiles`.

Se usa `SECURITY DEFINER` porque el alta inicial necesita insertar en tablas con
RLS cerrada para usuarios normales. La funcion no recibe parametros de tenant,
usa `auth.uid()` y valida el correo contra el JWT cuando Supabase lo provee.

## Aplicacion Manual

Aplicar manualmente en Supabase SQL Editor, en el proyecto de desarrollo:

1. Abrir `database/migrations/0002_bootstrap_empresa.sql`.
2. Revisar el SQL completo.
3. Ejecutarlo despues de `0001_core_schema.sql`, `0001_core_rls.sql` y
   `0001_core_seed.sql`.
4. Probar signup, login y onboarding.

No aplicar en produccion sin probar antes en Supabase dev.

## Pendientes

- Administracion avanzada de usuarios.
- Invitaciones a usuarios existentes de una empresa.
- Seleccion/upgrade de plan.
- Configuraciones privadas cifradas para integraciones futuras.
