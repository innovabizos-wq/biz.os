# Agenda De Seguimientos

Agenda es una vista operativa sobre los seguimientos ya creados en CRM. Su
objetivo es ordenar el trabajo diario sin crear un calendario complejo ni
duplicar la logica de clientes.

## Incluye

- resumen de seguimientos de hoy
- seguimientos vencidos
- proximos seguimientos
- completados recientes
- lista filtrable por alcance, estado y rango
- completar, cancelar y reabrir seguimientos
- reasignar seguimientos a usuarios activos de la empresa
- enlace al detalle del cliente CRM

## Relacion Con CRM

Agenda usa la tabla existente `crm_seguimientos` y muestra datos de
`crm_clientes`. Los seguimientos se siguen creando desde el detalle del cliente;
Agenda solo agrega una vista de operacion diaria y acciones rapidas.

## No Incluye Todavia

- calendario visual
- drag and drop
- recordatorios automaticos
- integracion Google Calendar
- WhatsApp real
- llamadas reales
- cotizaciones
- ventas
- inventario
- despacho
- facturacion
- IA

## RPCs

La migracion local `database/migrations/0008_crm_followups_agenda.sql` agrega:

- `obtener_agenda_seguimientos`
- `reasignar_crm_seguimiento`

Agenda reutiliza la RPC existente:

- `cambiar_estado_crm_seguimiento`

Las RPCs resuelven la empresa con `current_empresa_id()` y no aceptan
`empresa_id` desde frontend.

## Permisos

- `crm.followups.view`: requerido para ver `/agenda` y `/agenda/seguimientos`.
- `crm.followups.edit`: requerido para completar, cancelar, reabrir o reasignar.
- `crm.followups.create`: no es necesario para ver Agenda.

El modulo `crm` debe estar activo para la empresa.

## Seguridad Multiempresa

Agenda no recibe `empresa_id` desde formularios ni parametros de URL. La empresa
se resuelve server-side desde `auth.uid()` -> `profiles.id` ->
`profiles.empresa_id`. Las RPCs filtran por esa empresa y validan permisos antes
de leer o mutar seguimientos.

## Aplicacion Manual

Aplicar manualmente en Supabase SQL Editor:

```text
database/migrations/0008_crm_followups_agenda.sql
```

No ejecutar automaticamente desde la app y no usar `SUPABASE_SERVICE_ROLE_KEY`.

## Prueba Manual

1. Entrar como usuario con CRM activo y permisos de seguimientos.
2. Crear un cliente o prospecto desde `/crm/clientes/nuevo`.
3. Abrir el detalle del cliente.
4. Crear un seguimiento.
5. Abrir `/agenda` y confirmar que aparece en el resumen correspondiente.
6. Abrir `/agenda/seguimientos`.
7. Filtrar por hoy, vencidos, proximos 7 dias o todos.
8. Marcar un seguimiento como completado.
9. Cancelar otro seguimiento.
10. Reabrir un seguimiento completado o cancelado si aplica.

## Proximos Pasos

- recordatorios
- calendario visual
- tareas operativas
- integracion WhatsApp
- integracion de llamadas
- integracion Google Calendar
