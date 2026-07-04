# Inbox Meta config

Esta fase prepara la configuracion oficial de canales Meta para Inbox. El modelo
conceptual objetivo no es que cada cliente final consiga por su cuenta las APIs
de Meta. AInovaCR/biz.os debe operar como proveedor de la tecnologia Whapp y
provisionar los datos tecnicos del canal.

## Incluye

- Canales oficiales Meta por empresa.
- Configuracion publica no sensible en `inbox_canales.configuracion_publica`.
- Secretos en `inbox_canal_secretos` con referencias Vault cuando estan disponibles.
- Estado seguro de secretos sin mostrar valores completos.
- Regeneracion local de `verify_token`.
- URL sugerida de webhook: `/api/webhooks/meta`.
- RPCs con `SECURITY DEFINER`, permisos y resolucion server-side de empresa.
- Formulario guiado por canal para pedir solo los datos necesarios.
- Checklist de preparacion para saber si falta configuracion publica, secretos o
  webhook.
- Webhook oficial Meta con verificacion de firma.
- Envio manual WhatsApp cuando el canal esta activo, configurado y con
  credenciales completas.

## No incluye todavia

- OAuth completo.
- Meta Embedded Signup.
- Bots, IA o automatizaciones.
- Plantillas oficiales fuera de ventana de 24 horas.
- Envio real por Facebook Messenger o Instagram.

## Modelo multiempresa y provision

biz.os no usa un numero global para todas las empresas. Cada empresa debe tener
su propio canal y numero asignado, pero la configuracion tecnica debe ser
administrada por Platform Admin / AInovaCR.

Modelo objetivo:

- El cliente recibe o contrata un numero nuevo apto para WhatsApp API.
- Ese numero puede venir de una provision telefonica asociada, por ejemplo una
  central virtual con proveedor como RingCR si el producto lo decide.
- Platform Admin configura Meta Business, WABA, `phone_number_id`, tokens,
  secreto de app, verify token y webhook.
- Tenant Owner ve numero, estado, salud y errores legibles, no secretos completos.

Regla comercial:

- No prometer uso de numeros existentes registrados en WhatsApp/WhatsApp Business.
- Para Meta, el numero debe estar apto para API; si el cliente quiere usar un
  numero existente, debe liberarse/migrarse segun reglas de Meta.
- Para piloto y venta simple, preferir numero nuevo provisionado por biz.os o su
  proveedor telefonico.

## Datos publicos vs secretos

Datos tecnicos administrados por Platform Admin:

- `phone_number_id`
- `waba_id`
- `page_id`
- `instagram_business_account_id`
- `business_id`
- `app_id`
- `access_token`
- `app_secret`
- `verify_token`

Datos visibles para Tenant Owner:

- Numero asignado.
- Nombre del canal.
- Estado del canal.
- Health.
- Ultimo evento.
- Ultimo error legible.

Los secretos se guardan en tabla privada sin policy SELECT para usuarios
normales. Cuando Vault esta disponible, la tabla conserva referencias y flags,
no los valores completos. La UI solo muestra booleanos como "configurado" o
"no configurado".

## Aplicacion manual

Aplicar manualmente:

```text
database/migrations/0018_inbox_meta_channels.sql
```

`SUPABASE_SERVICE_ROLE_KEY` se lee solo desde `src/lib/supabase/admin.ts`,
marcado `server-only`. Se usa en webhook Meta y en wrappers server-only de
Inbox que validan usuario, empresa y permiso antes de llamar RPCs reservadas a
`service_role`. No usarlo en frontend ni ejecucion automatica de migraciones.

## Prueba funcional

1. Platform Admin provisiona el canal y numero.
2. Platform Admin configura los datos tecnicos Meta.
3. Tenant Owner ve el canal como pendiente/configurando/activo/con error.
4. Tenant Owner prueba conversaciones y operacion diaria.
5. Platform Admin revisa health, webhook y errores tecnicos.

## Rutas

- `/inbox/canales`
- `/inbox/canales/nuevo`
- `/inbox/canales/[canalId]`

## Proximos pasos

- Plantillas oficiales.
- OAuth / Embedded Signup para reducir copia manual de IDs y tokens.
- Platform Console para provision y soporte Whapp.
- Estados delivered/read.
