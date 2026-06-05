# Consolidacion Tecnica y UX MVP

Fecha: 2026-06-03

## Estado actual del MVP

biz.os esta listo para demo operativa controlada en estos bloques:

- Auth, onboarding, TenantContext, roles y permisos tipados.
- Dashboard principal con KPIs reales o estados vacios; no debe mostrar cifras financieras falsas.
- Nueva consulta conectada a busqueda interna, Hacienda, CRM, interacciones y notificaciones.
- CRM clientes con historial de interacciones, seguimientos, cotizaciones y ventas relacionadas.
- Agenda de seguimientos comerciales.
- Cotizaciones con items manuales/catalogo, edicion antes de venta y venta confirmada sin duplicar.
- Catalogo de productos/servicios.
- Ventas como puente a inventario y despacho.
- Inventario con bodegas, stock, movimientos, importacion y traslado entre bodegas.
- Despacho como centro operativo con mapa Leaflet/OpenStreetMap y `driver_live_status`.
- RRHH/Planillas con widget, estados configurables y dashboard operativo.
- Notificaciones persistentes por usuario.

## Flujos listos

- Nueva consulta -> cliente existente/nuevo -> gestion -> notificacion -> Ver cliente.
- Cliente CRM -> interaccion -> seguimiento -> Agenda -> completar/cancelar/reabrir.
- Cliente/Cotizaciones -> crear cotizacion con items -> confirmar venta -> venta interna.
- Venta -> aplicar inventario o marcar sin inventario -> crear despacho.
- Despacho -> mapa real -> empty state sin choferes -> tabla -> detalle.
- Inventario -> entrada/importacion -> stock -> traslado entre bodegas -> movimientos.
- Planillas -> estado del usuario -> dashboard operativo.

## Flujos parcialmente listos

- Facturacion/Fiscal: existe configuracion fiscal y preparacion local de factura, pero la emision real requiere firma XAdES-EPES, XML v4.4 firmado, envio y consulta Hacienda.
- Inbox/Whapp: existen canales, conversaciones, webhooks y diagnosticos; debe tratarse como modulo en desarrollo hasta probar extremo a extremo con credenciales Meta reales.
- Dashboard: muestra datos reales disponibles; las metricas financieras avanzadas quedan pendientes hasta tener pagos/costos/cuentas por cobrar.

## Modulos no listos para venta

- Facturacion electronica real.
- Compras/proveedores.
- Pagos/cuentas por cobrar.
- WhatsApp comercial completo con operacion real certificada.
- IA.
- App movil o app de chofer.
- Costos, margenes, lotes, series y reservas avanzadas.

## Riesgos tecnicos

- Migraciones locales recientes pueden estar pendientes de aplicacion manual en Supabase dev.
- Facturacion no debe presentarse como lista para Hacienda mientras falte XAdES-EPES.
- Inbox/Whapp depende de credenciales Meta, webhooks publicos y pruebas reales.
- Busqueda de clientes por documento necesita deuda futura: identificacion normalizada e indice por empresa/documento.
- Notificaciones no usan Realtime ni push; se actualizan por navegacion/revalidacion.

## Estado de migraciones Supabase

Revision 2026-06-05: `biz-os-dev` tiene registradas formalmente las migraciones
`0034` a `0039` aplicadas via MCP/Supabase. Las migraciones `0001` a `0033`
se tratan como baseline manual del estado vivo y no deben reejecutarse sobre
esa base sin comparar schema o restaurar en una base vacia.

Ver detalle en `docs/supabase-baseline-checkpoint.md`.

## Checklist manual de QA

1. Login.
2. Dashboard carga sin KPIs falsos ni tendencias inventadas.
3. Abrir boton flotante Nueva consulta.
4. Buscar cliente existente por documento.
5. Buscar documento no existente y completar manual.
6. Guardar gestion.
7. Ver notificacion “Gestion guardada”.
8. Marcar notificacion como leida.
9. Tocar Ver y abrir ficha del cliente.
10. Registrar interaccion desde cliente.
11. Crear seguimiento.
12. Ver seguimiento en Agenda.
13. Completar/cancelar/reabrir seguimiento.
14. Crear cotizacion.
15. Confirmar que no se puede crear cotizacion sin items.
16. Agregar item manual.
17. Agregar item de catalogo.
18. Editar cotizacion antes de venta.
19. Confirmar venta.
20. Confirmar que no duplica venta.
21. Ver que la cotizacion convertida muestra Ver venta.
22. Aplicar salida de inventario o marcar sin inventario.
23. Crear despacho desde venta.
24. Ver despacho en `/despacho`.
25. Ver mapa real sin error SSR.
26. Probar empty state sin choferes conectados.
27. Revisar inventario, movimientos y traslado entre bodegas.
28. Revisar planillas y widget.
29. Probar usuario sin permisos y validar mensajes humanos.

## Prueba de permisos con usuario limitado

1. Invitar un segundo usuario desde Administracion o RRHH.
2. Crear un rol limitado, por ejemplo `Operador basico`.
3. Asignar solo permisos minimos, por ejemplo `crm.customers.view` o `crm.followups.view`.
4. Iniciar sesion con ese usuario.
5. Confirmar que no ve modulos sin permiso.
6. Entrar por URL directa a un modulo sin permiso.
7. Confirmar que recibe un mensaje humano de acceso denegado.
8. Confirmar que no puede ejecutar acciones no autorizadas.

## Proximos pasos recomendados

- Antes de demo: aplicar migraciones pendientes en Supabase dev y ejecutar checklist manual completo.
- Antes de vender: automatizar pruebas E2E de Nueva consulta -> CRM -> Cotizacion -> Venta -> Inventario -> Despacho.
- Siguiente modulo grande sugerido: Facturacion electronica real, solo despues de cerrar firma XAdES-EPES y pruebas Hacienda en ambiente de pruebas.
