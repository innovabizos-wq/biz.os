# Configuración fiscal

La configuración fiscal se administra en `/admin/fiscal`. La pantalla muestra
una lista de preparación y no permite confundir una empresa incompleta con una
lista para emitir.

El perfil estructurado en `company_fiscal_settings` contiene:

- identificación y nombre fiscal del emisor;
- identificación del proveedor del sistema exigida por XML 4.4;
- provincia, cantón, distrito, barrio y otras señas;
- sucursal y terminal predeterminadas;
- condición de venta y forma de pago predeterminadas;
- moneda y ambiente fiscal.

El cliente conserva explícitamente el tipo de identificación fiscal `01`,
`02`, `03` o `04`. Número y tipo deben existir juntos. Biz.OS ya no supone que
toda cédula corresponde a una persona jurídica.

Los secretos de Hacienda se guardan cifrados con
`FISCAL_CONFIG_ENCRYPTION_KEY`. Las referencias y credenciales incluyen usuario,
contraseña, certificado y PIN; ninguno se muestra completo ni se entrega al
navegador después de guardarlo. La lectura heredada de
`configuraciones_empresa` continúa disponible para instalaciones anteriores.

La migración `20260914120000_fiscal_v44_required_profile.sql` enriquece cada
nuevo documento con la instantánea del perfil de la empresa y el tipo fiscal
del cliente. Si falta proveedor del sistema, ubicación o identificación del
receptor para una factura, el documento se crea en `error_validation` con una
explicación concreta y no puede avanzar a firma o envío.

Estados de salud:

- `missing`;
- `incomplete`;
- `ready_for_xml`;
- `ready_for_signing`;
- `ready_for_hacienda`;
- `error`.

`ready_for_hacienda` indica que la configuración necesaria está presente. La
salida comercial exige además una prueba aceptada en el ambiente externo de
Hacienda con las credenciales de la empresa.
