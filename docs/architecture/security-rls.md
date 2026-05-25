# Seguridad Y Supabase RLS

Supabase RLS sera una defensa central para evitar acceso cruzado entre empresas.
La interfaz mejora la experiencia, pero no es la fuente real de seguridad.

## Reglas Base

- Toda tabla sensible futura debe tener `empresa_id`.
- Las politicas RLS deben comparar el `empresa_id` del registro con la empresa
  del usuario autenticado.
- El frontend no es fuente confiable para `empresa_id`.
- Las mutaciones operativas deben resolver empresa desde sesion/profile.
- Los permisos no deben depender solo de botones visibles u ocultos.

## Validacion Backend

Cada accion sensible debe validar:

- sesion autenticada
- usuario activo
- empresa activa
- permiso requerido
- modulo activo cuando aplique
- plan vigente cuando aplique

## Tablas Del Nucleo

Tablas aprobadas para el nucleo:

```text
empresas
sucursales
profiles
roles
permisos
rol_permisos
modulos
empresa_modulos
planes
empresa_plan
configuraciones_empresa
auditoria_eventos
```
