# Widget Flotante De Inbox

El widget flotante de Inbox es una mini bandeja de mensajeria dentro de biz.os.
Esta fase construye la caratula visual y la navegacion interna tipo WhatsApp,
sin enviar mensajes reales ni integrar automatizaciones.

## Incluye

- Boton flotante verde de mensajeria sobre el boton `+`.
- Popup flotante con header, minimizar y cerrar.
- Vista de conversaciones.
- Vista de chat activo.
- Buscador visual.
- Filtros visuales rapidos.
- Burbujas para mensajes entrantes, salientes y notas internas.
- Carga de conversaciones reales del Inbox.
- Carga bajo demanda de mensajes reales al abrir una conversacion.

## No Incluye Todavia

- Envio real a WhatsApp, Facebook o Instagram.
- Adjuntos reales.
- Audio.
- Plantillas oficiales.
- IA.
- WebSockets.
- Supabase Realtime.
- Contador real de no leidos.

## Funcionamiento

El boton vive en el layout autenticado. Al abrirlo muestra un popup con dos
vistas: `Conversaciones` y `Chat activo`.

La lista usa las conversaciones existentes del modulo Inbox. Al seleccionar una
conversacion, el widget llama una server action para consultar sus mensajes y
los presenta como burbujas.

El textarea de respuesta es visual en esta fase. No envia mensajes reales.

## Pendientes

- Conectar respuesta simulada o real segun permisos.
- Estados de no leido.
- Tiempo real.
- Adjuntos.
- Plantillas.
- IA asistida.
