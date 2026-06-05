# Supabase Baseline Y Checkpoint Tecnico

Fecha de revision: 2026-06-05
Proyecto Supabase: `biz-os-dev` (`ctunnyqmgbpuyxdnwzgq`)
Estado: `ACTIVE_HEALTHY`
Postgres: `17.6.1.121`

## Estado Del Repositorio

El repositorio tiene una cantidad alta de cambios sin commitear. Este estado debe tratarse como un checkpoint tecnico pendiente de consolidar antes de iniciar trabajo funcional grande.

Ultimos commits visibles:

- `70578d3 primer deploy`
- `a6b78a5 Initial biz.os SaaS modules`
- `99aa148 Initial commit from Create Next App`

Migraciones locales presentes:

- `0001_core_schema.sql` a `0039_rls_initplan_cleanup.sql`

## Estado De Migraciones En Supabase

Supabase solo tiene historial formal registrado para las migraciones aplicadas via MCP desde el cierre tecnico:

- `20260604224413 platform_module_contract`
- `20260604224658 rpc_grants_and_rls_policies`
- `20260604224819 module_config_health_and_secret_refs`
- `20260604224923 fk_indexes_and_duplicate_index_cleanup`
- `20260604225320 remaining_fk_indexes`
- `20260604225638 rls_initplan_cleanup`

Las migraciones `0001` a `0033` se tratan como baseline manual del estado vivo. No deben reejecutarse contra `biz-os-dev` sin restaurar en una rama/base vacia o comparar schema antes.

## Checks De Seguridad Y Estructura

Resultado de la revision del 2026-06-05:

- Tablas publicas: `41`
- Tablas publicas con RLS: `41`
- Tablas con RLS sin politica: `0`
- Funciones `SECURITY DEFINER` ejecutables por `anon`: `0`
- Indices duplicados criticos restantes: `0`
- Permisos sin `modulo_codigo`: `0`
- Permisos asociados a modulos nuevos: `24`
- Edge Functions desplegadas: `0`

## Estado De Configuracion Y Secretos

- `configuraciones_empresa`: `2` filas.
- `inbox_canal_secretos`: `1` fila.
- Secretos Meta en almacenamiento inline: `1` fila.
- Secretos Meta con referencia Vault: `0` filas.

La operacion actual protege `inbox_canal_secretos` con RLS sin acceso directo a cliente y RPC controladas. La deuda pendiente es migrar el secreto inline a Vault o a una referencia equivalente sin romper la operacion actual.

## Estado De Modulos

Contrato local y Supabase ya reconocen:

- Core: `admin`, `crm`, `agenda`, `quotes`, `catalog`, `sales`, `inventory`, `dispatch`, `hr`.
- Opcionales: `billing`, `whapp`, `reports`, `autoblog`, `ai`, `purchases`, `payments`, `mobile`.

Los modulos futuros `purchases`, `payments` y `mobile` estan registrados, pero aun no tienen empresas activas ni health rows vivos.

## Estado De Health

`empresa_modulo_health` existe, pero todavia opera como semilla inicial:

- `inactive`: `12`
- `unknown`: `22`
- `ok`: `0`

Esto significa que la tabla ya permite monitoreo, pero faltan checks reales por modulo.

## Reglas De Cambio Desde Este Punto

- No reejecutar migraciones `0001` a `0033` en `biz-os-dev`.
- Todo DDL nuevo debe entrar como nueva migracion secuencial.
- No borrar indices marcados como `unused_index` sin ventana real de uso.
- No exponer `SUPABASE_SERVICE_ROLE_KEY` a cliente ni server actions de usuario.
- Webhooks Meta deben seguir usando `service_role` server-only.
- Antes de tocar produccion: branch Supabase o backup y repeticion de advisors.
