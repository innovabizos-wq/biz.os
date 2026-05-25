# Administracion De Usuarios

Esta fase habilita administracion basica de usuarios existentes por empresa.

## Alcance

Permite:

- ver usuarios de la empresa actual
- abrir detalle de usuario
- editar nombre y telefono del profile operativo
- cambiar rol
- cambiar sucursal
- cambiar estado: `activo`, `inactivo`, `suspendido`

No permite:

- crear usuarios manualmente
- crear contrasenas temporales
- cambiar correo
- cambiar empresa
- borrar usuarios fisicamente
- usar `SUPABASE_SERVICE_ROLE_KEY`

Los usuarios entran por invitacion y Supabase Auth gestiona la identidad.

## Seguridad

La migracion `database/migrations/0006_users_admin.sql` agrega RPCs
`SECURITY DEFINER` con `search_path` controlado. Ninguna RPC recibe
`empresa_id`; todas resuelven la empresa desde `current_empresa_id()`.

Permisos requeridos:

- ver usuarios: `admin.users.view` o `admin.users.manage`
- administrar usuarios: `admin.users.manage`

Las mutaciones validan que el usuario objetivo, rol y sucursal pertenezcan a la
empresa actual. La RPC de estado impide inactivar o suspender al usuario
autenticado.

## SQL Manual

Aplicar manualmente despues de `0005`:

```text
database/migrations/0006_users_admin.sql
```

No ejecutar automaticamente desde la app.

## Prueba Manual

1. Entrar como administrador.
2. Abrir `/admin/usuarios`.
3. Abrir el detalle de un usuario.
4. Editar nombre o telefono.
5. Cambiar rol.
6. Cambiar sucursal.
7. Cambiar estado.

## Pendientes

- Mejores mensajes por codigo SQL.
- Historial visual de auditoria.
- Reenvio y cancelacion de invitaciones.
- Politicas avanzadas por sucursal.
