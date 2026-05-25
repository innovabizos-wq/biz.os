# Administracion De Roles

Esta fase habilita administracion basica de roles por empresa en biz.os.

## Alcance

Permite:

- crear roles para la empresa actual
- editar nombre y descripcion
- activar o inactivar roles
- asignar y quitar permisos existentes del catalogo global
- ver detalle del rol y permisos asignados

No permite:

- crear permisos nuevos desde UI
- editar el catalogo global de permisos
- borrar roles fisicamente
- crear usuarios manualmente
- saltar RLS con `service_role`

## Seguridad

Las mutaciones pasan por RPCs en `database/migrations/0004_roles_admin.sql`.
Ninguna RPC recibe `empresa_id`; la empresa se resuelve con
`current_empresa_id()`, que depende de `auth.uid()` y `profiles`.

Todas las acciones sensibles requieren `admin.roles.manage`. La lectura de roles
requiere `admin.roles.view` o `admin.roles.manage`.

El SQL tambien agrega una politica RLS de lectura para `rol_permisos` limitada a
usuarios administrativos de la misma empresa. Las escrituras siguen cerradas y
pasan por RPC.

## RPCs

- `crear_rol_empresa`
- `actualizar_rol_empresa`
- `cambiar_estado_rol_empresa`
- `asignar_permiso_rol`
- `quitar_permiso_rol`

Las RPCs validan empresa actual, permisos y pertenencia del rol a la empresa.
Tambien registran eventos en `auditoria_eventos`.

## Aplicacion Manual

Aplicar manualmente en Supabase SQL Editor despues de `0001`, `0002` y `0003`:

```text
database/migrations/0004_roles_admin.sql
```

No ejecutar automaticamente desde la app.

## Prueba Manual

1. Entrar como administrador inicial.
2. Abrir `/admin/roles`.
3. Crear un rol en `/admin/roles/nuevo`.
4. Abrir el detalle del rol.
5. Editar nombre o descripcion.
6. Asignar y quitar permisos.
7. Activar o inactivar el rol.

## Pendientes

- Mejorar mensajes de error por codigo SQL.
- Confirmaciones antes de quitar permisos criticos.
- Historial visual de auditoria.
- Plantillas de roles por industria.
