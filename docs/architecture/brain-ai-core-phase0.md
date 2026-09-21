# Brain AI Core - Fase 0 y Fase 1

## Arquitectura encontrada

Biz.OS usa Next.js App Router en `src/app`, logica de dominio en `src/modules`, utilidades compartidas en `src/lib`, componentes reutilizables en `src/components` y migraciones SQL versionadas en `database/migrations`. La aplicacion esta organizada por modulos funcionales: CRM, Agenda, Cotizaciones, Catalogo, Ventas, Inventario, Despacho, RRHH, Facturacion, Whapp, Autoblog, Pagos, Compras, IA y Business Brain.

La seguridad se resuelve con Supabase Auth, perfiles operativos en `profiles`, `TenantContext`, permisos RBAC tipados en `src/types/core.ts`, activacion modular por empresa y RLS en PostgreSQL. La autorizacion efectiva sigue la regla `modulo activo + permiso del usuario`, con validaciones en Server Components, Server Actions, Route Handlers y funciones SQL/RLS. La IA no debe tener permisos propios: cualquier ejecucion futura debe actuar con el `TenantContext` del usuario autenticado.

La configuracion por empresa se guarda en `configuraciones_empresa`. La configuracion de IA actual esta unificada en la clave `ai_provider`, se administra desde `src/modules/ai/conversation-layer-service.ts`, cifra API keys con `src/modules/ai/crypto.ts` y expone providers mediante `src/lib/ai/providers`.

## Modulo BRAIN actual

El modulo existente vive en `src/modules/brain` y la ruta principal en `src/app/(app)/brain/page.tsx`. Actualmente hace analisis deterministico sobre datos reales, genera snapshots diarios, senales, insights, recomendaciones, memoria basica y planes accionables aprobables. Tambien delega funciones conversacionales a `src/modules/ai` mediante `src/modules/brain/ai-service.ts`.

Componentes actuales reutilizables:

- `queries.ts`: acceso a metricas, insights, recomendaciones, senales, memoria y planes con RBAC.
- `actions.ts`: Server Actions para analizar, aprobar recomendaciones y ejecutar planes.
- `connectors.ts`: recolectores deterministas por modulo.
- `analyst-service.ts`: orquestacion de analisis y recomendaciones.
- `plan-executor.ts`: puente hacia el execution bridge existente.
- `types.ts` y `schemas.ts`: modelos actuales de la superficie BRAIN.
- `page.tsx`: pantalla operativa del modulo BRAIN.

Partes extensibles:

- Agregar contratos del AI Core sin modificar los flujos existentes.
- Reusar `configuraciones_empresa` y `ai_provider` para configuracion.
- Reusar `TenantContext`, `PermissionCode`, `ModuleCode` y `JsonRecord`.
- Reusar el provider registry actual como adaptador inicial, no como dependencia directa del resto del sistema.

Partes que no deben tocarse en esta fase:

- Migraciones existentes.
- Logica deterministica de analisis.
- RLS/RPC existentes.
- Execution Bridge y action registry existente.
- Prompts y comportamiento conversacional actual.

## Fortalezas

- Separacion clara entre rutas, modulos, librerias y base de datos.
- RBAC y multiempresa ya son conceptos transversales y tipados.
- BRAIN ya existe como modulo opcional y no necesita ser recreado.
- La configuracion de proveedores de IA ya esta desacoplada del frontend y evita API keys hardcodeadas.
- El proyecto ya tiene contratos de pruebas con `node --test` y verificacion TypeScript.

## Problemas detectados

- La capa IA historica vive en `src/modules/ai` y BRAIN la reexporta, por lo que falta un contrato formal del Brain SDK que marque la frontera futura.
- El `AiProviderAdapter` actual esta orientado a `generateJson` y `test`; no expresa streaming, usage, timeouts, tool calls ni metadata de costos.
- El modulo BRAIN mezcla en el mismo namespace contratos de datos persistidos, analisis operativo y futuras capacidades de IA.
- Existen llamadas reales a proveedores en servicios actuales; la nueva infraestructura debe aislar esas llamadas detras de contratos.

## Riesgos

- Cambiar tablas o permisos existentes podria romper RLS o pantallas operativas. Por eso esta fase no crea migraciones nuevas.
- Mover la configuracion de IA fuera de `ai_provider` duplicaria estado. La configuracion del AI Core debe envolver la clave existente.
- Introducir herramientas reales ahora mezclaria infraestructura con capacidades de negocio. Se crea solo el contrato y un registry vacio.

## Arquitectura propuesta

Se agrega una capa `src/modules/brain/core` como Brain SDK interno. Esta capa define contratos puros y tipos estables para providers, tools, agents, conversations, memory, knowledge, execution, permissions, analytics y configuration. La aplicacion futura dependera de estos contratos, no de OpenAI, Gemini ni de un SDK concreto.

Decisiones:

- `contracts.ts` centraliza interfaces para mantener bajo el costo de evolucion inicial.
- `configuration.ts` adapta `ai_provider` al contrato `BrainConfigurationService`.
- `health.ts` ofrece un health check desacoplado usando el provider adapter actual, sin introducir chat ni especialistas.
- `tool-registry.ts` crea un registry vacio y tipado; no registra herramientas de negocio.
- `index.ts` expone la API publica del SDK interno.
- La pagina BRAIN muestra una base visual de infraestructura para crecer, sin cambiar la operacion existente.

## Archivos creados

- `src/modules/brain/core/contracts.ts`
- `src/modules/brain/core/configuration.ts`
- `src/modules/brain/core/health.ts`
- `src/modules/brain/core/tool-registry.ts`
- `src/modules/brain/core/index.ts`
- `docs/architecture/brain-ai-core-phase0.md`

## Tablas futuras

- `brain_conversations`
- `brain_conversation_messages`
- `brain_agent_definitions`
- `brain_tool_definitions`
- `brain_tool_executions`
- `brain_provider_health_checks`
- `brain_usage_events`
- `brain_knowledge_sources`
- `brain_knowledge_chunks`
- `brain_memory_entries`
- `brain_execution_runs`

No se crean en esta fase porque los contratos pueden convivir con las tablas existentes y no hay necesidad de cambiar persistencia para preparar la infraestructura.

## APIs futuras

- `GET /api/brain/core/health`
- `GET /api/brain/core/configuration`
- `PATCH /api/brain/core/configuration`
- `GET /api/brain/tools`
- `POST /api/brain/tools/validate`
- `GET /api/brain/agents`
- `POST /api/brain/executions`
- `GET /api/brain/conversations`
- `POST /api/brain/conversations`
- `GET /api/brain/analytics/usage`

No se crean en esta fase para evitar ampliar superficie publica sin controles completos de RBAC, auditoria y RLS.
