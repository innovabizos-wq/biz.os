# Nucleo De Base De Datos

Este documento describe el nucleo inicial de base de datos de biz.os. Los SQL
locales viven en `database/migrations`, `database/policies` y `database/seeds`.
No deben aplicarse a Supabase sin revision previa.

## Tablas Del Nucleo

- `empresas`: empresas cliente de biz.os.
- `sucursales`: sedes operativas de una empresa.
- `profiles`: perfil operativo del usuario autenticado de Supabase.
- `roles`: roles propios de cada empresa.
- `permisos`: catalogo tecnico global de permisos.
- `rol_permisos`: permisos asignados a roles por empresa.
- `modulos`: catalogo global de modulos de plataforma.
- `empresa_modulos`: modulos activos por empresa.
- `planes`: catalogo comercial global.
- `empresa_plan`: plan vigente o historico por empresa.
- `configuraciones_empresa`: configuraciones aisladas por empresa.
- `auditoria_eventos`: eventos operativos por empresa.

## Catalogos Globales

`permisos`, `modulos` y `planes` son catalogos globales. No contienen datos
operativos de clientes y se leen por usuarios autenticados solo cuando estan en
estado `activo`. Las mutaciones directas de usuarios normales quedan cerradas.

`permisos.modulo_codigo` referencia `modulos.codigo`, por eso los seeds cargan
primero modulos, despues planes y finalmente permisos.

## Tablas Sensibles Por Empresa

`empresas`, `sucursales`, `profiles`, `roles`, `rol_permisos`,
`empresa_modulos`, `empresa_plan`, `configuraciones_empresa` y
`auditoria_eventos` son sensibles por empresa. Su aislamiento depende de
`empresa_id` y de politicas RLS.

## current_empresa_id()

`public.current_empresa_id()` resuelve la empresa activa desde el usuario
autenticado:

```text
auth.uid() -> profiles.id -> profiles.empresa_id
```

La funcion devuelve empresa solo si el profile esta `activo`. Se define como
`security definer` para que las politicas RLS puedan resolver el tenant sin
recursion sobre `profiles`. No recibe parametros, usa `auth.uid()` y mantiene
referencias calificadas con `search_path` restrictivo.

## Aislamiento Por RLS

Las politicas iniciales permiten lectura minima:

- la empresa propia del usuario
- sucursales, roles, modulos activos y plan de su empresa
- el profile propio
- permisos del rol actual del usuario
- catalogos globales activos

No se crean politicas de escritura para usuarios normales. Las futuras
mutaciones deben pasar por backend, validar permisos, modulo activo y plan.

`configuraciones_empresa` queda cerrada a usuarios normales en esta fase. En el
futuro debe separarse configuracion publica de configuracion privada, y las
configuraciones sensibles de integraciones deben estar cifradas, aisladas o
accesibles solo por backend.

`auditoria_eventos` queda cerrada a usuarios normales. La insercion futura de
auditoria debe hacerse desde servicios backend controlados.

## Por Que profiles Tiene empresa_id

Un usuario operativo pertenece a una sola empresa. Por eso `profiles` contiene
`empresa_id` directamente y no existe una tabla `empresa_usuarios` para usuarios
compartidos.

La creacion inicial de `profiles` requiere un flujo backend/servicio controlado.
El frontend no debe enviar `empresa_id` como fuente confiable.

`profiles.correo` se mantiene unico y ademas se protege con un indice unico sobre
`lower(correo)` para evitar duplicados por diferencias de mayusculas.

## Usuarios No Compartidos

biz.os usa aislamiento fuerte: las empresas no comparten usuarios ni datos
operativos. Esto reduce ambiguedad de tenant y evita un selector de empresa para
usuarios normales.

## Superadmin De Plataforma

El superadmin de plataforma no vive en `profiles`, no usa `empresa_id = null` y
no aparece como usuario operativo de empresas cliente. Debe implementarse en una
capa separada futura, con auditoria propia y acceso explicito.

## Plan Activo

`empresa_plan` permite historial de planes, pero solo un registro con
`estado = 'activo'` por empresa mediante indice unico parcial. Esto evita que el
backend tenga que resolver planes activos ambiguos.

## Compatibilidad PostgreSQL

El schema usa claves foraneas compuestas con `ON DELETE SET NULL (columna)` para
mantener `empresa_id` obligatorio y limpiar solo la referencia opcional
(`sucursal_id`, `rol_id` o `usuario_id`). Esta sintaxis requiere PostgreSQL 15 o
superior. Antes de aplicar, confirmar la version del proyecto Supabase.

La extension `pgcrypto` se crea en el esquema `extensions`, que es el patron
normal en Supabase. El script crea el esquema si no existe.

## Orden Recomendado Para Aplicar

Cuando se conecte un proyecto Supabase real, revisar y aplicar en este orden:

1. `database/migrations/0001_core_schema.sql`
2. `database/policies/0001_core_rls.sql`
3. `database/seeds/0001_core_seed.sql`

## Advertencia

Estos archivos son una base inicial local. Antes de aplicar en staging o
produccion hay que revisar version de PostgreSQL, extensiones disponibles,
permisos, grants, estrategia de backups y compatibilidad exacta con Supabase.
No aplicar en produccion sin probar primero en un proyecto Supabase de
desarrollo.
