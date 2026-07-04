# Supabase Baseline Y Checkpoint Tecnico

Fecha de revision: 2026-06-06
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

- `0001_core_schema.sql` a `0049_block_payment_overpayments.sql`

## Estado De Migraciones En Supabase

Supabase solo tiene historial formal registrado para las migraciones aplicadas via MCP desde el cierre tecnico:

- `20260604224413 platform_module_contract`
- `20260604224658 rpc_grants_and_rls_policies`
- `20260604224819 module_config_health_and_secret_refs`
- `20260604224923 fk_indexes_and_duplicate_index_cleanup`
- `20260604225320 remaining_fk_indexes`
- `20260604225638 rls_initplan_cleanup`
- `20260605121339 production_hardening_vault_health_rpc`
- `20260605121512 revoke_legacy_whatsapp_send_config_grant`
- `20260605182949 auto_assign_optional_module_permissions`
- `20260605184951 revoke_unused_module_health_writer`
- `20260605190756 meta_secret_writes_server_only`

Las migraciones `0001` a `0033` se tratan como baseline manual del estado vivo. No deben reejecutarse contra `biz-os-dev` sin restaurar en una rama/base vacia o comparar schema antes.

Migraciones locales posteriores confirmadas en Supabase dev:

- `0048_purchases_payments_full_flow.sql` como `20260606034022 purchases_payments_full_flow`.
- `0049_block_payment_overpayments.sql` como `20260606112623 block_payment_overpayments`.

`0049` no crea producto nuevo: endurece el RPC `registrar_movimiento_cuenta`
para bloquear sobrepagos en vez de recortar montos con `least(...)`.

## Checks De Seguridad Y Estructura

Resultado de la revision del 2026-06-05:

- Tablas publicas: `41`
- Tablas publicas con RLS: `41`
- Tablas con RLS sin politica: `0`
- Funciones `SECURITY DEFINER` ejecutables por `anon`: `0`
- RPC legacy `obtener_inbox_whatsapp_send_config(uuid)` ejecutable por `authenticated`: `0`
- Indices duplicados criticos restantes: `0`
- Permisos sin `modulo_codigo`: `0`
- Permisos asociados a modulos nuevos: `24`
- Edge Functions desplegadas: `0`

## Estado De Configuracion Y Secretos

- `configuraciones_empresa`: `2` filas.
- `inbox_canal_secretos`: `1` fila.
- Secretos Meta en almacenamiento inline: `0` filas.
- Secretos Meta con referencia Vault: `1` fila.

La operacion actual protege `inbox_canal_secretos` con RLS sin acceso directo a cliente, Vault y RPC server-only para lectura de secretos completos.

## Estado De Modulos

Contrato local y Supabase ya reconocen:

- Core: `admin`, `crm`, `agenda`, `quotes`, `catalog`, `sales`, `inventory`, `dispatch`, `hr`.
- Opcionales: `billing`, `whapp`, `reports`, `autoblog`, `ai`, `purchases`, `payments`, `mobile`.

`purchases`, `payments`, `reports`, `ai` y `mobile` estan registrados como
modulos opcionales. Cuando se activan, los roles sistema `Administrador` y
`Super Admin` del tenant reciben permisos base por migracion `0045`; `mobile` sigue siendo
API-only y no debe aparecer en la barra lateral.

## Estado De Health

`empresa_modulo_health` ya se recalcula desde estado real de configuracion, credenciales y activacion:

- Modulos core con configuracion minima completa quedan `healthy`.
- Modulos opcionales inactivos quedan `inactive`.
- Modulos opcionales activos sin configuracion/credenciales quedan `misconfigured`.

El health actual ya sirve como compuerta operativa para detectar configuracion incompleta antes de terminar modulos externos.

## Reglas De Cambio Desde Este Punto

- No reejecutar migraciones `0001` a `0033` en `biz-os-dev`.
- Todo DDL nuevo debe entrar como nueva migracion secuencial.
- No borrar indices marcados como `unused_index` sin ventana real de uso.
- No exponer `SUPABASE_SERVICE_ROLE_KEY` a cliente ni leerlo fuera de
  `src/lib/supabase/admin.ts`.
- `createServiceRoleClient` debe permanecer marcado `server-only`, con imports
  allowlistados y sin uso desde Client Components.
- Server actions que usen `service_role` deben validar usuario, empresa y
  permiso antes de llamar RPC server-only.
- Webhooks Meta deben seguir usando `service_role` server-only.
- Antes de tocar produccion: branch Supabase o backup y repeticion de advisors.
