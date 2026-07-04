# Integrations Readiness

Este estado prepara integraciones futuras sin convertir placeholders en producto
completo.

## WhatsApp / Whapp

Estado: base operativa segura, con cambio conceptual hacia proveedor SaaS.

- Modulo opcional `whapp`.
- Rutas `/inbox` y `/whapp` protegidas por modulo activo.
- Webhook Meta usa route server y service role server-only.
- La UI debe mostrar configurado/faltante, ultimo evento y ultimo error.
- No mostrar tokens completos.
- El tenant no debe tener como tarea normal obtener y pegar credenciales Meta.
- AInovaCR/biz.os debe provisionar el canal, numero y configuracion tecnica,
  similar a un proveedor tipo Callbell.
- El cliente usa el numero asignado; para piloto/venta simple se debe preferir
  numero nuevo apto para Meta, no un numero existente ya registrado en WhatsApp.

Pendiente para venta:

- Definir flujo comercial/provision con numero nuevo, incluyendo proveedor
  telefonico si aplica.
- Prueba con webhook publico real administrado por plataforma.
- Validar firma Meta en ambiente productivo.
- Revisar reglas de ventana de 24h y plantillas aprobadas.

## Billing / Hacienda

Estado: base estructural.

- Modulo opcional `billing`.
- `/admin/fiscal` bloquea si el modulo esta inactivo.
- Server Actions fiscales bloquean si `billing` esta inactivo.
- Secretos fiscales se cifran con `FISCAL_CONFIG_ENCRYPTION_KEY`.

Pendiente para venta:

- XML 4.4 completo.
- Firma XAdES-EPES.
- Envio Hacienda.
- Consulta de estado.
- Representacion grafica.
- Notas credito/debito.

## IA

Estado: preparacion.

- Modulo opcional `ai`.
- Configuracion por empresa guarda proveedor/modelo/limites sin exponer API key.
- Eventos de uso se registran como contrato base.

Pendiente:

- Proveedor real.
- Tool registry con permisos por herramienta.
- Auditoria detallada por accion.
- Limites por empresa/usuario.

## Mobile

Estado: API base.

- Modulo opcional `mobile`.
- `/api/mobile/bootstrap` devuelve empresa, usuario, permisos y modulos activos sin secretos.
- `/api/mobile/dispatch` exige `mobile.access` y permisos de despacho.

Pendiente:

- App o vista movil.
- Ubicacion de chofer/tecnico.
- Evidencia de entrega.
- Notificaciones moviles.

## Autoblog

Estado: MVP manual y honesto.

- Modulo opcional `autoblog`.
- Consume contexto del negocio.
- Estados orientados a revision y "listo para publicar", sin prometer publicacion externa automatica.

Pendiente:

- Generacion IA real.
- Cron/fuentes automaticas.
- Publicacion externa.
- Publicacion en redes.
