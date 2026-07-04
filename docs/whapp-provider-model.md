# Whapp Provider Model

Whapp opera como tecnologia administrada por AInovaCR/biz.os, no como un
formulario para que cada cliente final copie credenciales de Meta.

## Modelo

- AInovaCR provisiona o coordina un numero nuevo apto para WhatsApp API.
- El numero queda asociado a la empresa cliente.
- Platform Admin configura Meta Business, WABA, Phone Number ID, App Secret,
  Access Token, Verify Token y webhook.
- Tenant Owner ve numero asignado, estado, health y operacion de inbox.
- Company Users atienden conversaciones segun permisos.

## Regla Comercial

Para piloto y venta simple se debe preferir un numero nuevo. Un numero existente
registrado en WhatsApp o WhatsApp Business App normalmente no esta listo para
Cloud API; si el cliente insiste, debe evaluarse liberacion o migracion segun
reglas de Meta.

## Visibilidad

Cliente ve:

- Numero asignado.
- Estado del canal.
- Inbox y conversaciones.
- Agentes/asignaciones cuando aplique.
- Errores legibles.

AInovaCR ve:

- Empresa.
- Proveedor.
- Phone Number ID.
- WABA ID.
- Webhook status.
- Health.
- Ultimo evento/error.

No se muestran secretos completos en UI.

