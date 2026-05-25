# Capa Logica Local Del Nucleo

La capa logica local de biz.os define contratos TypeScript, schemas Zod,
constantes y helpers del nucleo SaaS multiempresa antes de conectar Supabase
real.

## Por Que Existe

Permite fijar contratos de tenant, permisos, modulos activos y planes sin crear
datos falsos ni depender todavia de una base remota. Esta capa acompana el SQL
local de `database/`, pero no ejecuta migraciones ni consulta Supabase.

## Relacion Con SQL

Los tipos de `src/types/core.ts` mapean las tablas aprobadas:

- `empresas` -> `Empresa`
- `sucursales` -> `Sucursal`
- `profiles` -> `Profile`
- `roles` -> `Rol`
- `permisos` -> `Permiso`
- `rol_permisos` -> `RolPermiso`
- `modulos` -> `Modulo`
- `empresa_modulos` -> `EmpresaModulo`
- `planes` -> `Plan`
- `empresa_plan` -> `EmpresaPlan`
- `configuraciones_empresa` -> `ConfiguracionEmpresa`
- `auditoria_eventos` -> `AuditoriaEvento`

Los nombres TypeScript usan camelCase/PascalCase; las tablas SQL conservan los
nombres aprobados en espanol.

## Tenant Context

`TenantContext` representa el contexto operativo seguro:

- `empresaId`
- `profileId`
- `sucursalId`
- `rolId`
- `permissions`
- `activeModules`
- `planCode`

En produccion debe construirse server-side desde sesion Supabase, `profiles`,
RLS, roles, modulos activos y plan. El frontend no debe enviar `empresaId` como
fuente confiable.

## Permisos

Los permisos son codigos tipados con formato `modulo.recurso.accion`. Los
helpers locales validan listas ya resueltas:

- `hasPermission`
- `hasEveryPermission`
- `hasAnyPermission`

Estos helpers no consultan Supabase y no autorizan por si solos operaciones de
base de datos. Las mutaciones futuras deben validar permisos en servidor.

## Modulos Activos

`platform-modules` contiene el catalogo de codigos de modulos. No implementa CRM,
ventas, inventario, despacho, facturacion ni IA. Solo define codigos para que el
nucleo pueda validar disponibilidad futura por empresa.

## Planes

`plans` contiene codigos `starter`, `pro` y `enterprise`, mas helpers simples
para validar estado del plan y disponibilidad de una feature en limites ya
resueltos.

## Sin Datos Falsos

`src/lib/auth/session.ts` no devuelve usuario demo, empresa demo ni tenant demo.
Hasta conectar Supabase real, sus funciones devuelven un error controlado
`AUTH_NOT_CONNECTED`.

## Pendiente Para Auth Real

Para conectar auth real falta:

1. Leer sesion desde Supabase server client.
2. Consultar `profiles` del `auth.uid()`.
3. Resolver empresa, rol, permisos, modulos activos y plan.
4. Construir `TenantContext` server-side.
5. Mantener RLS como defensa principal.

## Pendiente Para Supabase Real

Antes de usar esta capa contra una base real hay que aplicar y probar los SQL en
Supabase de desarrollo, generar tipos de base si se adopta ese flujo, y conectar
queries server-side sin aceptar `empresaId` desde formularios operativos.
