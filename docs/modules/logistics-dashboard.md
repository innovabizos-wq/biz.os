# Panel logistico en Despacho

`/despacho` funciona como el modulo operativo de logistica. La primera etapa
agrega un panel superior de supervision sobre la lista y filtros existentes de
despachos.

## Incluye en esta fase

- KPIs compactos de choferes/responsables y despachos.
- Mapa real con Leaflet/OpenStreetMap.
- Resumen del dia con despachos, efectividad y retrasos.
- Distribucion visual por estado.
- Actividad reciente basada en despachos.
- Lista, filtros y tabla existentes de `/despacho` sin reemplazarlos.

## Datos reales

- KPIs de conectados y en ruta: responsables con despachos activos cuando
  existen responsables asignados; si no existen, usa conteo seguro de despachos
  activos.
- Pendientes: despachos en `pendiente`, `preparando` o `listo`.
- Entregados hoy: despachos `entregado` completados o actualizados hoy.
- Resumen del dia: despachos programados hoy o creados hoy sin fecha programada.
- Actividad reciente: ultimos despachos ordenados por `updated_at`/`created_at`.
- Tabla y filtros: componentes existentes del modulo Despacho.

## Temporal visual

El mapa no usa GPS real todavia. Espera ubicaciones reales desde
`driver_live_status` y muestra un estado vacio profesional cuando no hay
choferes conectados compartiendo ubicacion.

Los retrasos se muestran en `0` hasta que exista una regla formal de retraso.
Disponibles y almuerzo quedan en `0` mientras no exista una fuente confiable de
estado laboral o tracking de chofer.

## No incluye todavia

- Ruta separada de logistica.
- Tracking GPS.
- Google Maps, Waze o geocoding.
- Optimizacion de rutas.
- Rutas reales.
- Vista movil del chofer.
- `navigator.geolocation`.
- Historial de ubicaciones.
- WebSockets o Supabase Realtime.
- Tablas nuevas de choferes, ubicaciones, rutas o actividad logistica.
- SQL nuevo o migraciones.

## Seguridad y permisos

La vista usa permisos existentes de despacho:

```text
dispatch.orders.view
dispatch.orders.edit
dispatch.orders.status.change
```

No acepta `empresa_id` desde frontend. La empresa se resuelve desde el contexto
del usuario autenticado y las consultas reutilizan la capa actual de despacho.

## Fases futuras

- Aplicacion o vista movil para chofer.
- Ubicacion real con consentimiento.
- Rutas reales y asignacion de paradas.
- Incidencias operativas.
- Evidencia de entrega.
- Optimizacion de rutas.
