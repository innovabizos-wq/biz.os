# Operational Modules Roadmap

## Current Order

biz.os advances operational modules in this order:

1. Payments and accounts receivable.
2. Purchases and suppliers.
3. Operational reports.
4. Operational AI.
5. Autoblog automation.
6. Mobile API.
7. Official WhatsApp operation.
8. Official Hacienda billing.

WhatsApp and Hacienda remain at the end because they require external validation,
credentials and certification. Core modules must not depend critically on them.

## Implemented Contracts

- `/pagos` synchronizes real sales into receivable accounts and records payments.
- `/compras` creates suppliers, purchase orders and inventory receipts.
- `/admin/ia` stores provider metadata, limits and AI usage audit events.
- `/api/mobile/bootstrap` exposes authenticated tenant, permissions and active modules.
- `/api/mobile/dispatch` exposes an authenticated dispatch payload for mobile clients.
- Active optional modules auto-grant their active catalog permissions to system
  tenant `Administrador` and `Super Admin` roles when enabled, and existing active
  modules were backfilled through migration `0045`.
- The sidebar exposes the operational reports module as `Reportes` when
  `reports.dashboard.view` is available; HR timesheet reports are labeled
  `Planillas` to avoid hiding the transversal reports module.

## Production Rules

- Optional modules can be disabled without breaking core CRM, quotes, sales,
  catalog, inventory, dispatch, HR or agenda flows.
- Secrets are never returned to the browser. AI configuration stores only public
  provider metadata and `hasApiKey` style flags.
- Module pages and server actions must validate tenant, permission and active
  module before calling RPCs.
- Database changes must remain additive unless a dedicated cleanup window is
  approved.

## Next Hardening Front

- Review Supabase advisor warnings for `SECURITY DEFINER` RPCs exposed to
  `authenticated`. Keep intentionally callable RPCs only when they perform
  explicit tenant, module and permission checks internally.
- Move service-only operations out of browser-callable paths or revoke
  `authenticated` execute grants where the app already uses service-role server
  wrappers.
- Run an authenticated browser check after deployment: activate/deactivate
  `Compras`, `Pagos`, `Reportes` and `IA`, then confirm the sidebar/admin tabs
  update without manual role edits.
