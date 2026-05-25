# Driver live tracking

Esta fase deja preparado el backend para mostrar choferes conectados en el mapa
operativo de `/despacho`.

## Incluye

- Tabla `driver_live_status`.
- Permisos:
  - `driver.tracking.use`
  - `driver.tracking.view`
  - `driver.tracking.manage`
- RPCs seguras:
  - `obtener_choferes_en_vivo()`
  - `obtener_resumen_choferes_en_vivo()`
  - `upsert_estado_chofer_admin(...)`
- Consultas TypeScript en `src/modules/driver-tracking`.

## Como aparece un chofer

Un usuario aparece en el mapa cuando:

- existe como `profile` activo de la empresa,
- tiene rol Chofer o permiso `driver.tracking.use`,
- tiene fila en `driver_live_status`,
- `tracking_enabled = true`,
- tiene `latitude` y `longitude`,
- `last_seen_at` esta dentro de la ventana operativa reciente.

## No incluye todavia

- App movil.
- Vista `/chofer`.
- Envio real de ubicacion desde celular.
- Tracking historico.
- Rutas reales.
- Optimizacion.

## Proxima fase

Crear una vista de chofer o app movil para iniciar/finalizar jornada, cambiar
estado y enviar ubicacion con consentimiento.
