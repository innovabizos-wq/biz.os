# CRM Basico

El CRM basico es el primer modulo operativo de biz.os. Trabaja sobre el nucleo
multiempresa existente y respeta `empresa_id`, RLS, permisos y modulos activos.

## Incluye

- clientes y prospectos
- detalle de cliente
- interacciones manuales
- seguimientos basicos
- estados comerciales simples

## No Incluye Todavia

- WhatsApp real
- llamadas reales
- agenda avanzada
- cotizaciones
- ventas
- facturacion
- automatizaciones
- IA

## Tablas

La migracion `database/migrations/0007_crm_core.sql` crea:

- `crm_clientes`
- `crm_interacciones`
- `crm_seguimientos`

Todas las tablas tienen `empresa_id` y RLS.

## RPCs

- `crear_crm_cliente`
- `actualizar_crm_cliente`
- `crear_crm_interaccion`
- `crear_crm_seguimiento`
- `cambiar_estado_crm_seguimiento`

Ninguna RPC acepta `empresa_id`. Todas resuelven la empresa desde
`current_empresa_id()` y validan permisos con `current_user_has_permission()`.

## Permisos

- `crm.customers.view`
- `crm.customers.create`
- `crm.customers.edit`
- `crm.interactions.view`
- `crm.interactions.create`
- `crm.followups.view`
- `crm.followups.create`
- `crm.followups.edit`

La migracion asigna estos permisos automaticamente solo a roles de sistema
`Administrador`. Otros roles, como Ventas, deben recibir permisos manualmente
desde `/admin/roles`.

## Aplicacion Manual

Aplicar manualmente en Supabase SQL Editor:

```text
database/migrations/0007_crm_core.sql
```

No ejecutar automaticamente desde la app.

## Prueba Manual

1. Entrar como administrador.
2. Abrir `/crm`.
3. Ir a `/crm/clientes`.
4. Crear cliente o prospecto en `/crm/clientes/nuevo`.
5. Abrir detalle del cliente.
6. Editar datos comerciales.
7. Registrar una interaccion manual.
8. Crear un seguimiento.
9. Marcar seguimiento como completado o cancelado.

## Proximos Pasos

- llamadas y WhatsApp reales
- agenda comercial
- cotizaciones
- reportes CRM
- automatizaciones e IA
