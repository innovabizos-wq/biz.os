# Facturacion / Fiscal

## Estado actual

La configuracion fiscal vive en `/admin/fiscal`. Permite registrar datos de la
empresa, ambiente, actividad economica, sucursal, terminal, usuario Hacienda,
contrasena, llave `.p12` en Base64, PIN y correo emisor.

Los secretos se guardan cifrados server-side y no se muestran de vuelta al
navegador.

## Listo para MVP

- Ruta administrativa `/admin/fiscal`.
- Permisos `billing.fiscal.*` y `billing.invoices.*` tipados.
- Checklist de configuracion fiscal.
- Preparacion local de factura desde venta confirmada.
- Estado local inicial `borrador`.

## No listo para emision real

No se debe vender como facturacion completa hasta implementar y probar:

- XML v4.4 completo.
- Firma XAdES-EPES con llave criptografica `.p12`.
- OAuth/OIDC Hacienda.
- Envio a recepcion Hacienda.
- Consulta de estado.
- Procesamiento de respuesta XML.
- Estados `enviada`, `aceptada`, `rechazada` y `error` conectados a respuesta real.

## Seguridad

- No usar `SUPABASE_SERVICE_ROLE_KEY` en pantallas ni acciones de usuario.
- No aceptar `empresa_id` desde frontend.
- No exponer secretos fiscales.
- No mostrar credenciales existentes al navegador.

## Migraciones

Aplicar manualmente en Supabase dev cuando corresponda:

```text
database/migrations/0029_fiscal_commercial_flow.sql
```
