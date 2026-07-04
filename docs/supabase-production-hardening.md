# Supabase Production Hardening Status

Fecha: 2026-06-05.
Proyecto: `biz-os-dev` (`ctunnyqmgbpuyxdnwzgq`).

## Cerrado

- Migraciones vivas registradas hasta `meta_secret_writes_server_only`.
- Secretos Meta migrados a Vault:
  - `inbox_canal_secretos.rows_total = 1`
  - `vault_rows = 1`
  - `inline_secret_rows = 0`
- Webhook Meta y envio WhatsApp leen secretos por RPC `service_role`.
- `createServiceRoleClient` vive en `src/lib/supabase/admin.ts`, marcado
  `server-only`; `SUPABASE_SERVICE_ROLE_KEY` no se lee desde otros archivos de
  `src`.
- Los imports actuales de `createServiceRoleClient` estan limitados a webhook
  Meta y acciones Inbox que validan usuario, empresa y permiso antes de llamar
  RPC server-only.
- El RPC legacy `obtener_inbox_whatsapp_send_config(uuid)` ya no es ejecutable por `anon` ni `authenticated`.
- `buscar_canal_por_verify_token`, `verificar_meta_webhook_signature` y `obtener_inbox_whatsapp_send_config_server` quedan concedidos solo a `service_role`.
- Guardar secretos Meta y regenerar verify tokens usan RPC server-only:
  `guardar_inbox_canal_meta_secretos_server(...)` y
  `regenerar_inbox_canal_verify_token_server(...)`. Las RPC autenticadas
  legacy para esas escrituras ya no son ejecutables por `authenticated`.
- El writer directo `registrar_estado_salud_modulo(...)` ya no es ejecutable por
  `anon` ni `authenticated`; queda reservado para `service_role`.
- Health real de modulos se recalcula desde `recalcular_salud_modulos_empresa`.
- Cambios de modulos, fiscal y Meta disparan `recalcular_salud_modulos_empresa_actual`.
- RLS sigue activo y sin tablas publicas sin politica.
- No quedan RPC `SECURITY DEFINER` ejecutables por `anon`.

## Allowlist Pendiente

Supabase Advisor sigue marcando RPC `SECURITY DEFINER` ejecutables por `authenticated`.
En este proyecto esas RPC son la capa de negocio del MVP y no se pueden revocar masivamente sin romper flujos.

La regla operativa queda asi:

- Las RPC autenticadas deben validar `auth.uid()`.
- Las RPC tenant-aware deben validar empresa por `current_empresa_id()` o argumento server-only equivalente.
- Las mutaciones deben validar permiso antes de escribir.
- Las RPC que retornan secretos completos no pueden estar concedidas a `authenticated`.
- Las RPC de webhook o envio con secreto completo deben ser `service_role` only.

## Verificacion

- `npm run test`: verde.
- `npm run typecheck`: verde.
- `npm run lint`: verde sin warnings.
- `npm run build`: verde.
- `inbox_canal_secretos.inline_secret_rows`: `0`.
- `legacy_whatsapp_send_config_auth`: `0`.
