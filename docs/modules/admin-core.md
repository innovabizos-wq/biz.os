# Admin Base

Admin Base es el primer modulo administrativo real de biz.os. Permite revisar en
modo solo lectura el nucleo SaaS multiempresa ya creado para el tenant actual.

## Rutas

- `/admin`: resumen del nucleo.
- `/admin/empresa`: empresa actual.
- `/admin/usuario`: profile del usuario autenticado.
- `/admin/sucursal`: sucursal asociada al usuario.
- `/admin/rol`: rol actual y permisos visibles.
- `/admin/modulos`: activa o desactiva modulos disponibles para la empresa.
- `/admin/plan`: plan activo de la empresa.
- `/admin/contexto`: contexto transversal del negocio.

## Seguridad

Todas las paginas usan `TenantContext` resuelto server-side desde la sesion y
`profiles`. No aceptan `empresa_id` por params, query string ni formularios. RLS
sigue siendo la defensa principal para impedir lectura cruzada entre empresas.

## Modulos Por Empresa

`/admin/modulos` lista los modulos activos del catalogo y el estado de activacion
para la empresa actual. Los administradores con `admin.settings.manage` pueden
activar o desactivar filas en `empresa_modulos` sin enviar `empresa_id` desde el
frontend.

Regla SaaS actual:

- `modulos` es el catalogo global.
- `empresa_modulos` define si una empresa tiene disponible un modulo opcional.
- Los permisos definen que usuarios pueden usar funciones dentro de modulos
  disponibles.
- Para usar un modulo opcional se necesita modulo activo y permiso de usuario.
- Un permiso no habilita un modulo inactivo.
- Un modulo activo no omite permisos.

Modulos base actuales:

- `admin`
- `crm`

Los modulos base se consideran siempre activos porque sostienen configuracion,
tenant, clientes y operaciones transversales. No se pueden desactivar desde
`/admin/modulos`.

Modulos opcionales actuales:

- `sales`
- `inventory`
- `dispatch`
- `billing`
- `hr`
- `reports`
- `ai`
- `autoblog`

Los modulos opcionales pueden activarse o desactivarse desde `/admin/modulos`.
Cuando un modulo opcional esta inactivo no debe aparecer en la barra lateral y
las rutas principales deben mostrar un bloqueo humano si se entra por URL
directa.

Autoblog se activa desde esta pantalla. No se debe resolver con SQL manual por
cliente.

En el futuro esta pantalla debe respetar el plan contratado:

- modulos permitidos por plan.
- modulos bloqueados.
- upsell o solicitud de activacion.

## Solo Lectura

Este modulo no edita empresa, usuarios, roles, permisos ni planes. La gestion de
modulos por empresa ya esta disponible con permisos server-side especificos.

## No Incluye

No implementa CRM, ventas, inventario, despacho, facturacion, IA ni integraciones
externas. Solo muestra el estado del nucleo multiempresa.

## Proximos Pasos

- Administracion editable de empresa.
- Invitacion y gestion de usuarios.
- Roles editables por empresa.
- Configuracion segura de empresa.
- Permisos administrativos por accion.
