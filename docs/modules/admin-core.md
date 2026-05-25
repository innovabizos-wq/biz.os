# Admin Base

Admin Base es el primer modulo administrativo real de biz.os. Permite revisar en
modo solo lectura el nucleo SaaS multiempresa ya creado para el tenant actual.

## Rutas

- `/admin`: resumen del nucleo.
- `/admin/empresa`: empresa actual.
- `/admin/usuario`: profile del usuario autenticado.
- `/admin/sucursal`: sucursal asociada al usuario.
- `/admin/rol`: rol actual y permisos visibles.
- `/admin/modulos`: modulos activos de la empresa.
- `/admin/plan`: plan activo de la empresa.

## Seguridad

Todas las paginas usan `TenantContext` resuelto server-side desde la sesion y
`profiles`. No aceptan `empresa_id` por params, query string ni formularios. RLS
sigue siendo la defensa principal para impedir lectura cruzada entre empresas.

## Solo Lectura

Este modulo no edita empresa, usuarios, roles, permisos, modulos ni planes. Las
acciones administrativas vendran despues con permisos server-side especificos.

## No Incluye

No implementa CRM, ventas, inventario, despacho, facturacion, IA ni integraciones
externas. Solo muestra el estado del nucleo multiempresa.

## Proximos Pasos

- Administracion editable de empresa.
- Invitacion y gestion de usuarios.
- Roles editables por empresa.
- Configuracion segura de empresa.
- Permisos administrativos por accion.
