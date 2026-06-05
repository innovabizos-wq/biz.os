# Inbox Meta config

Esta fase prepara la configuracion oficial de canales Meta para Inbox. Cada
empresa registra sus propios datos de WhatsApp Business Cloud API, Facebook
Messenger o Instagram Messaging.

## Incluye

- Canales oficiales Meta por empresa.
- Configuracion publica no sensible en `inbox_canales.configuracion_publica`.
- Secretos en `inbox_canal_secretos`.
- Estado seguro de secretos sin mostrar valores completos.
- Regeneracion local de `verify_token`.
- URL sugerida de webhook: `/api/webhooks/meta`.
- RPCs con `SECURITY DEFINER`, permisos y resolucion server-side de empresa.
- Formulario guiado por canal para pedir solo los datos necesarios.
- Checklist de preparacion para saber si falta configuracion publica, secretos o
  webhook.

## No incluye todavia

- Envio real por WhatsApp, Facebook o Instagram.
- OAuth completo.
- Meta Embedded Signup.
- Bots, IA o automatizaciones.

## Modelo multiempresa

biz.os no usa un numero global para todas las empresas. Cada empresa debe
registrar su propio `phone_number_id`, WABA, pagina de Facebook o cuenta
profesional de Instagram.

## Datos publicos vs secretos

Datos publicos:

- `phone_number_id`
- `waba_id`
- `page_id`
- `instagram_business_account_id`
- `business_id`
- `app_id`

Campos minimos recomendados:

- WhatsApp: `phone_number_id`, `waba_id`, `app_id`.
- Facebook Messenger: `page_id`, `app_id`.
- Instagram Messaging: `instagram_business_account_id`, `page_id`, `app_id`.

Secretos:

- `access_token`
- `app_secret`
- `verify_token`

Los secretos se guardan en tabla privada sin policy SELECT para usuarios
normales. La UI solo muestra booleanos como "configurado" o "no configurado".

## Aplicacion manual

Aplicar manualmente:

```text
database/migrations/0018_inbox_meta_channels.sql
```

Usar `SUPABASE_SERVICE_ROLE_KEY` solo en la ruta backend del webhook Meta.
No usarlo en frontend, server actions de usuario ni ejecucion automatica de
migraciones.

## Prueba funcional

1. Ir a `/inbox/canales/nuevo?tipo=meta`.
2. Crear canal Meta WhatsApp.
3. Abrir `/inbox/canales/[canalId]`.
4. Guardar configuracion publica.
5. Guardar secretos.
6. Regenerar `verify_token` y copiarlo.
7. Revisar el estado seguro de secretos.
8. Revisar la checklist de preparacion.
9. Configurar en Meta el callback `/api/webhooks/meta` y suscribir `messages`.

## Rutas

- `/inbox/canales`
- `/inbox/canales/nuevo`
- `/inbox/canales/[canalId]`

## Proximos pasos

- Envio real.
- Plantillas oficiales.
- OAuth / Embedded Signup para reducir copia manual de IDs y tokens.
- Estados delivered/read.
