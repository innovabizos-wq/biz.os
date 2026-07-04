# Configuracion fiscal

La configuracion fiscal actual se administra en `/admin/fiscal` y guarda
secretos cifrados con `FISCAL_CONFIG_ENCRYPTION_KEY`.

La accion `saveFiscalConfigurationAction` mantiene compatibilidad con la
configuracion heredada cifrada en `configuraciones_empresa`, pero tambien
sincroniza `company_fiscal_settings` con datos fiscales estructurados y
referencias opacas de secretos:

- `hacienda_username_secret_ref`
- `hacienda_password_secret_ref`
- `certificate_secret_ref`
- `certificate_pin_secret_ref`

`company_fiscal_settings` no guarda PIN, certificado completo, usuario ni
contrasena en claro. La UI no debe mostrar PIN, certificado completo, usuario,
contrasena ni referencias completas.

La lectura de `getFiscalConfiguration` usa primero `company_fiscal_settings`
para que la UI, el flujo de emision y el health compartan la misma base
estructurada. Si no existe fila estructurada, cae a `obtener_configuracion_fiscal`
por compatibilidad con instalaciones que solo tienen la configuracion heredada.

Estados de salud esperados:

- `missing`
- `incomplete`
- `ready_for_xml`
- `ready_for_signing`
- `ready_for_hacienda`
- `error`
