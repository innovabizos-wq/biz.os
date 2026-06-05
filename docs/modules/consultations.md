# Nueva consulta

El flujo de nueva consulta permite iniciar una gestion desde el Dashboard usando
una cedula o documento.

## Flujo

1. El usuario abre `/consultas/nueva`.
2. Digita cedula o documento.
3. El sistema normaliza el valor quitando espacios y guiones.
4. Primero busca en CRM por `crm_clientes.identificacion`.
5. Si existe, usa ese cliente y no crea duplicado.
6. Si no existe, consulta Hacienda Costa Rica.
7. Si Hacienda encuentra datos, precarga nombre y datos tributarios disponibles.
8. Si Hacienda no encuentra datos o falla, permite completar manualmente.
9. Al guardar, vuelve a buscar en CRM por documento para evitar duplicados.
10. Crea cliente solo si todavia no existe.
11. Guarda la gestion en `crm_interacciones`.

## Hacienda

Endpoint usado:

```text
https://api.hacienda.go.cr/fe/ae?identificacion=DOCUMENTO
```

La identificacion para Hacienda debe ser numerica y tener entre 9 y 12 digitos.

## Cache

La consulta a Hacienda usa cache en memoria server-side:

- Encontrado: 24 horas.
- No encontrado: 1 hora.
- Error de red u otros errores temporales: 5 minutos.

Esto evita rafagas de solicitudes y reduce riesgo de 429.

## Errores humanos

- 400: formato no valido para Hacienda.
- 404: no encontrado, permite llenar manual.
- 429: Hacienda limito temporalmente consultas.
- Error de red: permite llenar manual.

## Permisos

- Buscar: `crm.customers.view`.
- Guardar gestion: `crm.interactions.create`.
- Crear cliente nuevo: `crm.customers.create`.

## Cotizar

El boton Cotizar guarda la gestion igual que Guardar y luego abre
`/cotizaciones/nueva?clienteId=...`. La gestion queda registrada como
interaccion del cliente antes de iniciar la cotizacion.

Guardar no redirige al CRM automaticamente. Cotizar debe crear o reutilizar el
cliente, guardar la gestion, crear la notificacion de gestion guardada y abrir
la nueva cotizacion con el cliente precargado.

## Limitaciones

CRM no tiene campos estructurados para direccion, regimen, situacion tributaria
o tipo de identificacion. En esta fase esos datos se guardan como notas del
cliente o dentro del resumen de la gestion cuando aplica.
