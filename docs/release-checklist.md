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
- Las RPC nuevas o modificadas validan `auth.uid()`, `current_empresa_id()` y permiso requerido.

## Entorno

- `.env.local` contiene Supabase, `NEXT_PUBLIC_APP_URL`, Meta y fiscal cuando aplique.
- `FISCAL_CONFIG_ENCRYPTION_KEY` configurado antes de guardar secretos fiscales.
- `SUPABASE_SERVICE_ROLE_KEY` configurado solo si hay webhooks server-only que lo requieren.
- `META_WEBHOOK_SKIP_SIGNATURE` solo puede estar en `true` en desarrollo.
- No existe `SUPABASE_SERVICE_ROLE_KEY` en helpers de frontend ni server actions de usuario.

## QA Funcional

- Onboarding crea empresa, rol fundador, modulos madre y plan.
- Usuario invitado acepta invitacion sin crear empresa nueva.
- Usuario limitado no ve rutas sin permiso y recibe mensaje humano por URL directa.
- CRM, Agenda, Cotizaciones, Ventas, Inventario, Despacho y RRHH completan el flujo MVP.
- Whapp/Inbox desaparece y bloquea rutas cuando `whapp` esta inactivo.
- Facturacion muestra configuracion/preparacion, pero no promete emision Hacienda hasta completar firma real.

## Pruebas Externas Separadas

- Meta: webhook publico, firma valida, canal configurado, mensaje entrante, envio manual y estados.
- Hacienda: ambiente pruebas, XML v4.4, XAdES-EPES, token, envio, consulta y respuesta oficial.
- Autoblog: publicacion desactivada por defecto hasta configurar canales externos.
- IA, compras, pagos y movil: activar solo cuando existan contratos, permisos, health checks y pruebas propias.
