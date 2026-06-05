# Health Checks Por Modulo

Fecha de revision: 2026-06-05

## Estado Actual

La tabla `empresa_modulo_health` ya existe y esta conectada al contrato de modulos, pero todavia no representa salud real. El estado vivo tiene:

- `inactive`: `12`
- `unknown`: `22`
- `ok`: `0`

La siguiente fase debe convertir estos registros en checks ejecutables.

## Contrato General

Cada modulo debe reportar:

- `status`: `ok`, `warning`, `error`, `inactive` o `unknown`.
- `configuration_complete`: boolean.
- `credentials_present`: boolean.
- `last_success_at`: timestamp del ultimo evento exitoso.
- `last_error_at`: timestamp del ultimo error.
- `last_error`: mensaje resumido sin secretos.
- `metadata`: JSON sin secretos completos.

## Checks Core

`admin`
- Verifica empresa activa, plan activo, rol activo y permisos admin base.

`crm`
- Verifica clientes accesibles por tenant, permisos CRM y RPC principales.

`agenda`
- Verifica seguimientos accesibles, permisos `crm.followups.*` y conexion con CRM.

`quotes`
- Verifica RPC de cotizaciones, permisos `quotes.*` y dependencia blanda con CRM/catalogo.

`catalog`
- Verifica productos/categorias y permisos `catalog.*`.

`sales`
- Verifica ventas, generacion desde cotizacion y dependencia blanda con inventario/despacho/pagos.

`inventory`
- Verifica bodegas, stock, movimientos y conexion con catalogo.

`dispatch`
- Verifica despachos, choferes en vivo y dependencia blanda con mobile.

`hr`
- Verifica estados de planilla, registro propio y dashboard.

## Checks Opcionales

`billing`
- Configuracion fiscal completa.
- Llave de cifrado presente.
- Hacienda environment definido.
- Facturas preparadas sin exponer secretos.
- Estado futuro: XML v4.4, firma XAdES-EPES, envio y consulta Hacienda.

`whapp`
- Canal Meta activo.
- Credenciales presentes.
- Webhook route con `SUPABASE_SERVICE_ROLE_KEY`.
- Ultimo webhook recibido.
- Ultimo mensaje saliente real.
- Secretos sin exposicion directa al cliente.

`reports`
- Dashboard carga con datos reales o empty states.
- No usa metricas falsas.

`autoblog`
- Contexto de negocio presente.
- Articulos/temas accesibles.
- Estado futuro: programador, revision, publicacion e historial de fallos.

`ai`
- Proveedor configurado.
- Credenciales presentes.
- Limites y auditoria de uso.
- Contexto de negocio disponible.

`purchases`
- Proveedores activos.
- Ordenes de compra.
- Recepcion contra inventario.
- Costos vinculados.

`payments`
- Cuentas por cobrar.
- Saldos, abonos y vencimientos.
- Relacion venta/factura/pago.

`mobile`
- API estable.
- Auth y permisos.
- Modulos activos expuestos.
- Casos iniciales: chofer, ventas rapidas y notificaciones.

## Orden De Implementacion

1. Implementar health real para `admin`, `crm`, `quotes`, `catalog`, `sales`, `inventory`, `dispatch`, `hr`.
2. Implementar health de `billing` y `whapp` porque dependen de credenciales.
3. Implementar `reports`, `autoblog`, `ai`.
4. Agregar `purchases`, `payments`, `mobile` cuando sus tablas/API existan.

## Regla De Seguridad

Los health checks no deben retornar secretos completos. Solo pueden exponer flags como `credentials_present`, `has_access_token`, `has_app_secret`, `has_verify_token` y mensajes de error sanitizados.
