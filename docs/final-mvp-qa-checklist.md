# Final MVP QA Checklist

Ejecutar manualmente despues de `npm run test`, `npm run typecheck`,
`npm run lint`, `npm run build` y `git diff --check`.

## Acceso

- Login con usuario admin.
- Login con usuario limitado.
- Usuario limitado no ve rutas sin permiso.
- URL directa sin permiso muestra mensaje humano.

## Modulos

- Activar/desactivar Autoblog.
- Activar/desactivar Compras.
- Activar/desactivar Pagos.
- Activar/desactivar Whapp.
- Activar/desactivar Billing.
- Confirmar que core no muestran accion de desactivar.
- Confirmar que sidebar cambia despues de activar/desactivar.

## CRM / Consulta

- Crear nueva consulta con cliente existente.
- Crear nueva consulta con busqueda Hacienda si hay servicio disponible.
- Crear nueva consulta con cliente manual.
- Guardar gestion.
- Crear cotizacion desde consulta.
- Confirmar que no hay doble submit visible.

## Cotizaciones / Ventas

- Crear cotizacion con item manual.
- Crear cotizacion con producto fisico.
- Crear cotizacion con servicio.
- Intentar confirmar venta sin items y validar mensaje.
- Confirmar venta.
- Abrir venta creada.
- Confirmar que venta no se duplica.

## Inventario

- Ver stock por bodega.
- Registrar entrada manual si el permiso aplica.
- Registrar salida manual si el permiso aplica.
- Aplicar salida desde venta con stock suficiente.
- Intentar salida con stock insuficiente.
- Revisar historial de movimientos.

## Compras

- Crear proveedor.
- Crear orden con items.
- Intentar emitir orden sin items.
- Emitir orden.
- Recibir parcial.
- Recibir restante.
- Intentar recibir mas de lo pendiente.
- Confirmar movimiento de inventario.

## Pagos

- Sincronizar CxC desde ventas.
- Sincronizar CxP desde compras.
- Registrar pago parcial.
- Registrar pago final.
- Intentar monto mayor al saldo y validar bloqueo.
- Revisar historial de movimientos.
- Anular cuenta si aplica.

## Despacho

- Crear despacho desde venta.
- Ver detalle de despacho.
- Cambiar estado.
- Confirmar que estados finales no permiten cambios indebidos.
- Abrir mapa sin choferes y validar empty state.

## Notificaciones

- Crear seguimiento asignado.
- Confirmar notificacion al asignado.
- Abrir notificacion.
- Confirmar que el click marca leido.

## Contexto / Autoblog

- Guardar contexto de negocio.
- Ver resumen de contexto.
- Crear articulo manual.
- Cambiar estado a aprobado.
- Cambiar estado a listo para publicar.
- Confirmar que no se marca como publicado en internet.

## Whapp / Billing Health

- Ver Whapp health sin credenciales.
- Ver checklist de canal Meta.
- Confirmar que no se muestran secretos completos.
- Ver Billing health sin credenciales/certificado.
- Confirmar que secretos fiscales no se muestran de vuelta.

