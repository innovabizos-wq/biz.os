# Capa de conversacion

La Capa de conversacion es el traductor inteligente entre el usuario y biz.os.
Interpreta lenguaje natural, devuelve una intencion estructurada para el backend
y convierte respuestas tecnicas en mensajes claros para el usuario.

## Que hace

- Convierte instrucciones naturales en JSON estructurado.
- Detecta intencion, modulo, accion sugerida, datos extraidos y campos faltantes.
- Marca si la accion necesita confirmacion.
- Redacta respuestas humanas a partir de respuestas tecnicas del sistema.
- Permite configurar proveedor, modelo, temperatura, tokens, Base URL y API Key.

## Que no hace

- No ejecuta acciones criticas directamente.
- No modifica base de datos por si sola.
- No crea facturas, clientes, inventario, pagos ni documentos fiscales.
- No inventa clientes, productos, precios, CABYS ni datos fiscales.
- No expone API Keys al frontend.

## Flujo recomendado

```text
usuario
-> IA interpreta
-> backend valida
-> backend ejecuta con logica propia
-> IA naturaliza la respuesta
```

## Configuracion

La configuracion vive en `configuraciones_empresa` bajo la clave
`ai_conversation_layer`, usando los RPC existentes:

- `obtener_configuracion_empresa`
- `guardar_configuracion_empresa`

La API Key se guarda cifrada con `AI_SETTINGS_ENCRYPTION_KEY`. El frontend solo
recibe `hasApiKey` y `apiKeyLast4`.

Valores recomendados:

- Proveedor: Gemini
- Modelo: `gemini-2.5-flash-lite`
- Temperatura: `0.2`
- Maximo de tokens: `1200`
- Salida: JSON estricto

## Proveedores

Gemini usa la API generativa con `responseMimeType: application/json`.

OpenAI-compatible usa `/chat/completions` y permite Base URL configurable. Esto
soporta OpenAI, Groq, OpenRouter y Ollama compatible.

Ejemplo OpenAI-compatible:

```text
provider: openai-compatible
baseUrl: https://api.openai.com/v1
model: gpt-4.1-mini
```

Ejemplo Gemini:

```text
provider: gemini
model: gemini-2.5-flash-lite
```

## Uso desde modulos

Modulos ejemplo donde puede integrarse gradualmente:

- Facturacion: interpretar solicitudes de factura y pedir cliente/producto faltante.
- Inventario: interpretar consultas de stock o movimientos, sin ajustar existencias directamente.
- Clientes: interpretar busquedas, creacion asistida o aclaraciones de datos faltantes.
- WhatsApp: naturalizar respuestas tecnicas de conversaciones, plantillas o webhooks.
- Reportes: interpretar consultas de lectura y entregar parametros estructurados.

```ts
import { runConversationLayer, naturalizeResponse } from "@/modules/ai/conversation-layer-service";

const intent = await runConversationLayer({
  module: "facturacion",
  userMessage: "hagame una factura a Juan con 2 tubos",
  availableActions: ["crear_factura", "buscar_cliente", "buscar_producto"],
  requiredFields: {},
  context: {},
});

const response = await naturalizeResponse({
  module: "facturacion",
  technicalResponse: {
    status: "error",
    code: "CLIENT_MULTIPLE_MATCHES",
    matches: ["Juan Perez", "Juan Mora"],
  },
  userOriginalMessage: "hagame factura a Juan",
});
```

Respuesta esperada para facturacion:

```json
{
  "intent": "crear_factura",
  "module": "facturacion",
  "confidence": 0.8,
  "action": "buscar_cliente",
  "data": {},
  "missing_fields": [],
  "needs_confirmation": true,
  "safe_to_execute": false,
  "reply_to_user": ""
}
```

## Endpoints internos

- `GET /api/ai/conversation-layer/settings`
- `POST /api/ai/conversation-layer/settings`
- `POST /api/ai/conversation-layer/test`
- `POST /api/ai/conversation-layer/interpret`
- `POST /api/ai/conversation-layer/naturalize`

Todos validan sesion, modulo IA activo y permisos. Los endpoints nunca devuelven
la API Key completa ni stack traces.

## Errores esperados

- `CONVERSATION_LAYER_DISABLED`
- `PROVIDER_NOT_CONFIGURED`
- `API_KEY_MISSING`
- `PROVIDER_CONNECTION_FAILED`
- `INVALID_AI_RESPONSE`
- `JSON_PARSE_FAILED`
- `UNSAFE_ACTION_BLOCKED`

## Consideraciones de seguridad

- La IA solo interpreta y redacta.
- El backend del modulo decide si puede ejecutar.
- Las acciones criticas deben pasar por validaciones propias del modulo.
- Para facturacion, pagos, inventario, clientes y documentos fiscales,
  `safe_to_execute` debe mantenerse en `false` hasta validacion del backend.
- No usar variables `NEXT_PUBLIC_*` para secretos de proveedor.
