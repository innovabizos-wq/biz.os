# Admin Usuarios, Roles Y Permisos

Este modulo agrega vistas administrativas de solo lectura para inspeccionar
usuarios, roles y permisos del tenant actual.

## Rutas

- `/admin/usuarios`: perfiles visibles por RLS.
- `/admin/roles`: roles visibles de la empresa actual.
- `/admin/permisos`: permisos del usuario actual y catalogo global activo.

## Solo Lectura

No crea usuarios, no invita usuarios, no edita roles y no modifica permisos. Las
acciones administrativas se implementaran despues con permisos server-side
especificos.

## RLS

Las consultas usan el Supabase server client y el `TenantContext` resuelto desde
sesion/profile. No reciben `empresa_id` desde frontend.

La pagina de usuarios respeta la politica actual de `profiles`. Si RLS solo
permite leer el profile propio, la tabla mostrara solo ese registro y avisara que
la lectura completa requiere una politica administrativa futura.

## Sin service_role

Estas vistas no usan `SUPABASE_SERVICE_ROLE_KEY` ni intentan saltarse RLS. Si una
consulta no puede leer datos por politicas actuales, muestra estado vacio seguro.

## Pendientes

- Invitacion de usuarios.
- Edicion de roles.
- Asignacion de permisos.
- Politicas administrativas para listar todos los profiles de una empresa.
- Auditoria de cambios administrativos.
