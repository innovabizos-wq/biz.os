# Supabase Current State

Fecha de revision: 2026-06-06

Este documento es un cierre de estado, no una instruccion para ejecutar
migraciones remotas. Cualquier aplicacion contra Supabase debe hacerse en branch,
backup o entorno dev controlado.

## Migraciones

Baseline manual:

- `0001_core_schema.sql` a `0033_company_modules_management.sql`.
- No reejecutar este bloque sobre una base viva sin comparar schema.

Migraciones de hardening ya documentadas:

- `0034_platform_module_contract.sql`
- `0035_rpc_grants_and_rls_policies.sql`
- `0036_module_config_health_and_secret_refs.sql`
- `0037_fk_indexes_and_duplicate_index_cleanup.sql`
- `0038_remaining_fk_indexes.sql`
- `0039_rls_initplan_cleanup.sql`
- `0040_production_hardening_vault_health_rpc.sql`
- `0041_revoke_legacy_whatsapp_send_config_grant.sql`
- `0042_operational_modules_payments_purchases_ai_mobile.sql`
- `0043_operational_modules_fk_covering_indexes.sql`
- `0044_emergency_unassign_operational_future_permissions.sql`
- `0045_auto_assign_optional_module_permissions.sql`
- `0046_revoke_unused_module_health_writer.sql`
- `0047_meta_secret_writes_server_only.sql`
- `0048_purchases_payments_full_flow.sql`
- `0049_block_payment_overpayments.sql`

Estado remoto verificado:

- `0048` aplicada como `20260606034022 purchases_payments_full_flow`.
- `0049` aplicada como `20260606112623 block_payment_overpayments`.
- El RPC `registrar_movimiento_cuenta` remoto bloquea `p_monto > saldo` y ya no usa `least(...)`.

## Modulos Registrados

Core:

- `admin`, `crm`, `agenda`, `quotes`, `catalog`, `sales`, `inventory`, `dispatch`, `hr`.

Opcionales:

- `billing`, `whapp`, `reports`, `autoblog`, `ai`, `purchases`, `payments`, `mobile`.

Regla vigente:

- Los core se consideran activos por contrato aunque exista una fila inactiva.
- Los opcionales deben bloquear sidebar, URL directa y Server Actions si estan inactivos.
- `mobile` es API-only.

## Tablas Criticas

- Tenant y seguridad: `empresas`, `profiles`, `roles`, `permisos`, `rol_permisos`, `modulos`, `empresa_modulos`.
- CRM/comercial: `crm_clientes`, `crm_interacciones`, `crm_seguimientos`, `cotizaciones`, `cotizacion_items`, `ventas`, `venta_items`.
- Operacion: `inventario_stock`, `inventario_movimientos`, `despachos`, `driver_live_status`.
- Integraciones: `configuraciones_empresa`, `empresa_modulo_health`, `inbox_canales`, `inbox_canal_secretos`, `inbox_conversaciones`, `inbox_mensajes`.
- Piloto: `purchases_suppliers`, `purchases_orders`, `purchases_receipts`, `payments_accounts`, `payments_transactions`, `ai_usage_events`.

## RPC Allowlist Publica

Categoria `public_user_api`:

- RPC transaccionales usadas por Server Actions autenticadas.
- Deben validar `auth.uid()`, empresa actual, permiso y modulo activo cuando aplique.

Categoria `self_service`:

- Invitaciones, onboarding y notificaciones propias.
- Deben filtrar por usuario actual.

Categoria `server_only`:

- Webhook Meta y lectura/escritura de secretos completos.
- Deben usarse solo desde `src/lib/supabase/admin.ts` via `createServiceRoleClient`.

La auditoria detallada vive en `docs/supabase-rpc-security-audit.md`.

## Secretos

- `SUPABASE_SERVICE_ROLE_KEY`: solo server-only, sin `NEXT_PUBLIC_`.
- Meta: secretos completos detras de Vault/RPC server-only; UI muestra estado, no valor.
- Fiscal: secretos cifrados con `FISCAL_CONFIG_ENCRYPTION_KEY`; UI no devuelve valores.
- IA futura: API keys server-side; el estado visible debe ser configurado/faltante.

## Advisor

- Supabase Advisor fue revisado despues de aplicar `0049`.
- Los warnings de `SECURITY DEFINER` restantes deben quedar en allowlist.
- Produccion no debe avanzar sin leaked password protection activado.
