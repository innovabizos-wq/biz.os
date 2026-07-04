# Release Checklist biz.os

Usar este checklist antes de una demo seria, entrega a cliente o despliegue.

## Codigo

- `npm run test` pasa.
- `npm run typecheck` pasa.
- `npm run lint` no tiene errores.
- `npm run build` pasa.
- No hay archivos temporales, logs locales ni backups dentro del cambio a entregar.
- Los cambios grandes quedan agrupados por dominio y no mezclan features no relacionadas.

## Base De Datos

- Migraciones aplicadas manualmente en Supabase dev en orden.
- `database/migrations/0034_platform_module_contract.sql` aplicado despues de `0033`.
- Modulos madre visibles como activos y bloqueados en `/admin/modulos`.
- Modulos opcionales pueden activarse/desactivarse sin romper rutas madre.
- Al activar modulos opcionales, Administrador y Super Admin del tenant reciben permisos base del modulo.
- Confirmar que `Super Admin` se entiende como rol de empresa cliente, no como Platform Admin/AInovaCR.
- Las RPC nuevas o modificadas validan `auth.uid()`, `current_empresa_id()` y permiso requerido.
- Supabase Advisor revisado; los WARN restantes de RPC `SECURITY DEFINER`
  deben estar documentados en `docs/supabase-rpc-security-audit.md`.
- Supabase Auth leaked password protection activado antes de produccion.

## Entorno

- `.env.local` contiene Supabase, `NEXT_PUBLIC_APP_URL`, Meta y fiscal cuando aplique.
- Secretos tecnicos de Meta/Whapp deben ser provisionados por Platform Admin, no por usuarios normales del tenant.
- `FISCAL_CONFIG_ENCRYPTION_KEY` configurado antes de guardar secretos fiscales.
- `BILLING_HACIENDA_SEND_ENABLED` y `BILLING_HACIENDA_STATUS_ENABLED` permanecen
  en `false` hasta validar OAuth, endpoints y payloads reales de Hacienda.
- URLs `HACIENDA_TEST_*`/`HACIENDA_PROD_*` completas solo en servidor; no usar
  variables `NEXT_PUBLIC_` para endpoints o credenciales fiscales.
- `SUPABASE_SERVICE_ROLE_KEY` configurado solo si hay webhooks o wrappers
  server-only que lo requieren.
- `META_WEBHOOK_SKIP_SIGNATURE` solo puede estar en `true` en desarrollo.
- `SUPABASE_SERVICE_ROLE_KEY` se lee unicamente desde
  `src/lib/supabase/admin.ts`, marcado `server-only`.
- Los imports de `createServiceRoleClient` estan allowlistados y nunca aparecen
  en Client Components.
- Toda server action que use `createServiceRoleClient` valida usuario, empresa y
  permiso antes de llamar una RPC server-only.

## QA Funcional

- Onboarding crea empresa, rol fundador, modulos madre y plan.
- Usuario invitado acepta invitacion sin crear empresa nueva.
- Usuario limitado no ve rutas sin permiso y recibe mensaje humano por URL directa.
- CRM, Agenda, Cotizaciones, Ventas, Inventario, Despacho y RRHH completan el flujo MVP.
- Compras, Pagos, Reportes e IA aparecen como piloto usable cuando estan activos y el rol tiene permisos base.
- Whapp/Inbox desaparece y bloquea rutas cuando `whapp` esta inactivo.
- Facturacion muestra configuracion/preparacion, pero no promete emision Hacienda hasta completar firma real.

## Pruebas Externas Separadas

- Meta/Whapp: numero nuevo apto para Meta provisionado por plataforma, webhook publico, firma valida, canal configurado, mensaje entrante, envio manual y estados.
- Hacienda: ambiente pruebas, XML v4.4, XAdES-EPES, token, envio, consulta y respuesta oficial.
- Autoblog: publicacion desactivada por defecto hasta configurar canales externos.
- Movil: contratos API autenticados listos para piloto tecnico; app nativa queda fuera de esta entrega.
