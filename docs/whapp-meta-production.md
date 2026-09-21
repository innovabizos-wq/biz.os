# Whapp + Meta: operacion de produccion

Documento operativo vigente para el modelo administrado de biz.os. El cliente final no copia tokens, no configura webhooks y no entra a Meta for Developers.

## Experiencia del cliente

1. En biz.os abre `Inbox > Redes y mensajeria`.
2. Pulsa conectar Facebook o Instagram.
3. Meta muestra sus pantallas de inicio de sesion, seleccion y autorizacion.
4. El cliente acepta y vuelve a biz.os.
5. biz.os suscribe los webhooks, guarda los secretos en servidor, activa los canales y registra al propietario OAuth para revocacion/eliminacion.

WhatsApp se provisiona como canal administrado. El cliente opera conversaciones, CRM, etiquetas, funnel y campanas; AInovaCR/biz.os mantiene App ID, App Secret, Login Configuration ID, webhook, WABA, Phone Number ID y tarifas.

## Configuracion unica de AInovaCR

En Vercel, abrir el proyecto correcto `innovabizos-wq-biz.os` y entrar a `Project Settings > Environment Variables`. Configurar en Production y Preview:

- `META_APP_ID`
- `META_APP_SECRET`
- `META_FACEBOOK_LOGIN_CONFIG_ID`
- `META_OAUTH_STATE_SECRET`
- `NEXT_PUBLIC_APP_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CRON_SECRET`
- `WHAPP_CAMPAIGN_WORKER_SECRET`

En Meta for Developers, dentro de la app biz.os:

1. En Facebook Login for Business registrar `${NEXT_PUBLIC_APP_URL}/api/meta/connect/callback` como URI OAuth valida.
2. En Webhooks registrar `${NEXT_PUBLIC_APP_URL}/api/webhooks/meta` y el verify token del canal.
3. En Configuracion basica usar `${NEXT_PUBLIC_APP_URL}/privacidad` como politica de privacidad.
4. En eliminacion de datos usar `${NEXT_PUBLIC_APP_URL}/api/meta/data-deletion`.
5. En desautorizacion usar `${NEXT_PUBLIC_APP_URL}/api/meta/deauthorize`.
6. Completar verificacion de negocio, dominios, icono, categoria y contacto de la app.
7. Solicitar revision solo de permisos realmente usados.

## Permisos usados

- Messenger: `pages_show_list`, `pages_read_engagement`, `pages_manage_metadata`, `pages_messaging`.
- Instagram: `instagram_basic`, `instagram_manage_messages`, `pages_show_list`, `pages_read_engagement`.
- WhatsApp administrado: `whatsapp_business_management`, `whatsapp_business_messaging`.

No solicitar `ads_management`, `business_management` ni permisos de marketing pagado mientras no exista una funcion concreta que los use. El acceso avanzado y la revision deben corresponder al caso de uso publicado.

## Webhooks

La conexion OAuth suscribe automaticamente:

- Messenger: `messages`, `messaging_postbacks`, `message_deliveries`, `message_reads`, `message_echoes`.
- Instagram: `messages`, `messaging_postbacks`, `message_reactions`, `messaging_seen`.
- WhatsApp: el objeto WABA debe permanecer suscrito a `messages`.

El endpoint valida `X-Hub-Signature-256`, limita el cuerpo, registra eventos y procesa mensajes, estados WhatsApp, entregas/lecturas Messenger e Instagram, ecos y reacciones. Si falla el complemento de estados responde `500` para que Meta reintente.

## Consentimiento y bajas

- Cada destinatario de campana exige evidencia, origen, version del aviso, finalidad y mercado.
- Un mensaje entrante registra consentimiento de servicio para esa identidad.
- Las bajas exactas como `STOP`, `ALTO`, `SALIR`, `BAJA` o `CANCELAR` revocan envios y excluyen destinatarios pendientes.
- Los envios manuales y masivos consultan la preferencia antes de llamar a Meta.
- Marketing exige consentimiento comercial; Utility/Authentication exige consentimiento de servicio.

## Ventanas, plantillas y calidad

- Texto libre solo se envia dentro de la ventana de atencion de 24 horas.
- Fuera de la ventana se usa una plantilla oficial.
- Las plantillas manuales son borradores locales; solo una sincronizacion desde Meta puede marcarlas como aprobadas.
- El envio se bloquea si la plantilla no esta `APPROVED`, esta pausada/eliminada o no se sincronizo dentro de la vigencia configurada.
- `Actualizar salud Meta` consulta calidad y limite del numero. Calidad roja pausa el canal.
- El despachador aplica intervalo minimo, limites horarios/diarios y pausa por tasa de fallos.

## Cobro Meta

Meta cobra por cada mensaje entregado, segun mercado y categoria. Service y Utility en respuesta al usuario no se cobran dentro de la ventana aplicable; los puntos de entrada gratuitos pueden abrir 72 horas sin cargo. El webhook conserva el objeto `pricing` y su bandera facturable; el ledger relaciona WAMID, mensaje, destinatario, categoria, mercado, moneda, tarifa y posicion mensual.

En `/platform/whapp`, AInovaCR registra las tarifas oficiales con mercado Meta, categoria, moneda, vigencia, tramo mensual y URL fuente. Utility y Authentication seleccionan el costo marginal del tramo alcanzado; Marketing y Service usan un solo tramo. Una campana no sale si falta mercado, categoria oficial o tarifa vigente. Los importes quedan como estimados hasta su conciliacion con la factura de Meta.

El mercado se infiere del telefono del destinatario (`+506` usa `REST_OF_LATIN_AMERICA`, `+52` usa `MEXICO`). El campo manual queda solo como override para numeracion especial.

Referencias oficiales:

- [WhatsApp Business Platform pricing](https://developers.facebook.com/docs/whatsapp/pricing/)
- [WhatsApp Cloud API webhooks](https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/)
- [Messenger Platform webhooks](https://developers.facebook.com/docs/messenger-platform/webhooks/)
- [Instagram messaging](https://developers.facebook.com/docs/messenger-platform/instagram/)
- [Meta App Review](https://developers.facebook.com/docs/app-review/)

## Etiquetas y funnel

- `/whapp/clasificacion` administra etiquetas, colores, funnels, etapas y orden.
- El popup conserva su diseño y consume el catalogo mediante selectores.
- La relacion actual vive en tablas normalizadas; `inbox_eventos` conserva la auditoria historica.
- El cambio de etapa actualiza `entered_at`, permitiendo medir conversion y tiempo por etapa.

## Verificacion antes de publicar

1. Aplicar `supabase/migrations/20260814090000_whapp_meta_compliance_and_classification.sql`.
2. Ejecutar `npm.cmd run typecheck`, pruebas de contratos, lint y build.
3. En `/platform/whapp` cargar tarifas vigentes de los mercados que se usaran.
4. En `/whapp/plantillas` sincronizar plantillas oficiales.
5. En cada canal WhatsApp pulsar `Actualizar salud Meta`.
6. Con una cuenta de prueba enviar mensaje entrante, responder dentro de 24 horas y confirmar `enviado > entregado > leido`.
7. Probar una baja enviando `STOP`; confirmar que el siguiente envio queda bloqueado.
8. Probar una campana con un destinatario autorizado y verificar costo/estado de cobro.
9. Probar desconexion y el endpoint de eliminacion de datos con una solicitud firmada de Meta.
10. Desplegar a Production y repetir el smoke test contra el dominio final.
