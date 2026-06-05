# Mapa real en Despacho

`/despacho` mantiene el centro operativo de despacho/logistica y ahora usa un
mapa real basado en Leaflet y OpenStreetMap.

## Mapa

- Librerias: `leaflet` y `react-leaflet`.
- Tiles: OpenStreetMap.
- Centro inicial sin choferes: Costa Rica/GAM (`9.9281`, `-84.0907`).
- No usa Google Maps.
- No usa Waze.

## Estado vacio

Si no hay choferes con ubicacion real, el mapa se mantiene visible y muestra:

```text
Aun no hay choferes conectados compartiendo ubicacion.
Cuando un usuario con rol Chofer inicie jornada desde la app o vista movil,
aparecera aqui.
```

No se muestran marcadores falsos.

## Datos reales

Los marcadores salen de `driver_live_status` mediante la RPC
`obtener_choferes_en_vivo()`. Los contadores de choferes salen de
`obtener_resumen_choferes_en_vivo()`.

Los KPIs de pendientes y entregados hoy siguen saliendo de despachos reales.

## Pendiente

- Vista/app de chofer.
- Envio de ubicacion desde celular.
- Historial de ubicaciones.
- Rutas reales.
- Optimizacion.
