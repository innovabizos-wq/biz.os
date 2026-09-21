# Biz.Brain Capability Matrix

Fecha: 2026-08-15

## Estado del salto central (etapas 0 a 7)

Implementado el 2026-08-15:

| Etapa | Objetivo | Estado y evidencia |
| --- | --- | --- |
| 0. Línea base | Medir comprensión y localizar las rutas paralelas que hacían rígida la barra. | Completa. Auditoría reproducible y corpus de 250 frases en `brain-stage-0-baseline.md` y `semantic-corpus.ts`. |
| 1. Núcleo único | Hacer que el modelo seleccione Business Skills tipadas bajo permisos reales, sin exigir comandos exactos. | Completa. `ToolLoopAgent`, selección semántica dinámica, Provider Gateway y un único `BusinessSkillRegistry`. |
| 2. Conversación y contexto | Mantener un hilo canónico entre la barra y `/brain`, consultar datos bajo demanda y responder con evidencia y enlaces. | Completa. `brain_conversations`, `brain_messages`, contexto de empresa/rol y las dos superficies sobre `/api/brain/chat`. |
| 3. Ejecución segura y durable | Pausar, aprobar y reanudar mutaciones sin duplicar efectos; registrar runs, pasos, eventos y uso. | Completa. Policy Engine central, aprobaciones verificadas contra el payload original, idempotencia y Vercel Workflow. |
| 4. Experiencia y orquestación | Sustituir la barra técnica por una experiencia de conversación, exponer progreso, herramientas y feedback, y conservar el catálogo de especialistas/workflows. | Completa en código. Streaming con AI Elements, navegación controlada, feedback útil/no útil, catálogo de agentes y workflows multi-Skill. |
| 5. Equipos IA + humanos | Coordinar especialistas en paralelo y pausar trabajo cuando deba intervenir una persona. | Completa en código. Supervisor, presupuestos y límites por agente, DAG durable, equipos persistidos, tareas humanas notificadas y checkpoints que sobreviven sesiones largas. |
| 6. Conocimiento + clientes | Conocer marca, contexto, FAQ, políticas y catálogo sin mezclar información interna con la visible al cliente. | Completa en código. Fuentes/documentos/chunks versionados, búsqueda híbrida texto + vector, procedencia/vigencia, audiencias estrictas y adaptador de cliente con verificación de identidad. |
| 7. Autopiloto gobernado | Reaccionar a eventos sin perder control, medir valor y detener Skills defectuosas. | Completa en código. Reglas suggest/approve/auto, modo sombra, rollout porcentual, ventanas/límites, deduplicación, circuit breaker, ejecuciones por regla, métricas de valor y registro de evaluaciones. |

Las migraciones aditivas que activan la persistencia central son
`database/migrations/0074_brain_central_runtime.sql` y
`database/migrations/0075_brain_teams_knowledge_autopilot.sql`, con fuentes
canónicas idénticas en `supabase/migrations/`. `npm run migrations:brain:check`
falla si cualquiera de las copias diverge.

### Contratos centrales disponibles

- Conversación streaming: `POST /api/brain/chat`.
- API interna: `POST /api/brain/interactions` con `ask`, `suggest`, `invoke` y `startRun`.
- Manifiesto vivo del tenant: `GET /api/brain/capabilities`.
- Equipos y personas: `/api/brain/teams` y `/api/brain/work-items`.
- Conocimiento: `/api/brain/knowledge`, `/api/brain/knowledge/sync` y `/api/brain/customer/respond`.
- Autopiloto: `/api/brain/autonomy/rules`, `/api/brain/triggers`, `/api/brain/autonomy/health` y `/api/brain/evals`.
- Observación y control: `/api/brain/runs/:id` y `/api/brain/runs/:id/cancel`.

La activación en producción requiere aplicar ambas migraciones, configurar el
modelo de embeddings si se desea búsqueda vectorial y ejecutar las pruebas de
aceptación con datos reales. Sin esos pasos, el código está listo pero la etapa
no debe considerarse desplegada.

### Frontera alcanzada

Brain ya no necesita que el usuario conozca un `action_id` ni escriba una frase
exacta. El modelo recibe solo las Skills permitidas para ese tenant y puede
encadenarlas; el runtime conserva la autoridad sobre schemas, permisos,
aprobaciones y ejecución. Los especialistas siguen siendo configuraciones
acotadas del mismo catálogo: no tienen acceso directo a Supabase.

## Principios

Biz.Brain es el runtime central de inteligencia empresarial de Biz.OS. El chat,
la barra global, los modulos, jobs, webhooks, APIs, automatizaciones y futuros
agentes deben consumir el mismo Runtime.

Reglas de arquitectura:

- Brain nunca debe inventar informacion que el sistema puede consultar.
- Primero consulta datos reales, luego razona y finalmente responde.
- Toda funcionalidad inteligente nace como una Capability antes de llegar a una
  interfaz.
- Ningun modulo debe llamar un proveedor de IA directamente para resolver una
  capacidad empresarial.
- Cada Capability tiene una unica responsabilidad.
- Las tareas complejas se componen con multiples Capabilities.
- El catalogo no tiene limite fijo. Esta matriz es una priorizacion inicial, no
  un techo.

## Jerarquia

```text
Origen
  -> Intent Resolver
  -> Business Intent
  -> Context Builder
  -> Capability Registry
  -> Slot Validator
  -> Policy Engine
  -> Brain Runtime
  -> Skill Registry
  -> Skill Executor
```

- Intent: lo que el usuario, modulo o proceso quiere lograr.
- Capability: capacidad empresarial estable y reutilizable.
- Skill: implementacion concreta, versionada y ejecutable.

## Matriz Inicial Priorizada

| Area | Capabilities objetivo | Estado inicial |
| --- | ---: | --- |
| CRM | 30 | busqueda y creacion implementadas; priorizacion planificada |
| Inventario | 30 | stock y reorden implementados |
| Ventas | 25 | consulta de ventas implementada |
| Cotizaciones | 25 | borrador implementado |
| Compras | 20 | ordenes y sugerencia implementadas |
| Pagos y Finanzas | 30 | cobros vencidos y recordatorio implementados |
| Facturacion | 25 | borrador fiscal implementado |
| WhatsApp e Inbox | 25 | borrador de respuesta implementado |
| Agenda y Tareas | 20 | creacion de tarea implementada |
| Dashboard y Reportes | 25 | planificado sobre capabilities de lectura |
| Admin y Configuracion | 20 | planificado |
| Autoblog y Contenido | 10 | generacion de articulo implementada |
| Brain Operativo | 15 | analisis, pregunta y contexto implementados |

Total inicial de referencia: 280 capabilities priorizadas.

## Capabilities Implementadas En Fase 2A

| Capability | Skill actual | Responsabilidad |
| --- | --- | --- |
| `crm.customer.search` | `crm.customer.search` | Buscar clientes autorizados |
| `crm.customer.create` | `crm.customer.create` | Crear cliente o prospecto |
| `catalog.product.search` | `catalog.product.search` | Buscar productos o servicios |
| `catalog.product.create` | `catalog.product.create` | Crear producto o servicio |
| `inventory.stock.query` | `inventory.stock.query` | Consultar stock |
| `inventory.reorder.suggest` | `inventory.reorder.suggest` | Sugerir reorden |
| `sales.summary.query` | `sales.summary.query` | Consultar ventas |
| `quotes.draft.create` | `quotes.draft.create` | Crear borrador de cotizacion |
| `agenda.task.create` | `agenda.task.create` | Crear tarea |
| `payments.overdue.query` | `payments.overdue.query` | Consultar cobros vencidos |
| `payments.collection-reminder.create` | `payments.collection-reminder.create` | Crear recordatorio de cobro |
| `purchases.order.query` | `purchases.order.query` | Consultar ordenes de compra |
| `purchases.reorder.suggest` | `purchases.reorder.suggest` | Sugerir compra |
| `dispatch.pending.query` | `dispatch.pending.query` | Consultar despachos pendientes |
| `billing.draft.prepare` | `billing.draft.prepare` | Preparar borrador fiscal |
| `inbox.reply.draft` | `inbox.reply.draft` | Preparar respuesta Inbox |
| `autoblog.article.generate` | `autoblog.article.generate` | Generar articulo Autoblog |
| `brain.analysis.run` | `brain.analysis.run` | Ejecutar analisis Brain |
| `brain.question.answer` | `brain.question.answer` | Responder pregunta estrategica |
| `brain.context.open` | `brain.context.open` | Abrir contexto del negocio |

## Capability Planificada Critica

| Capability | Estado | Motivo |
| --- | --- | --- |
| `crm.customer.next_best` | planificada | Evita que Brain invente recomendaciones comerciales sin una skill que consulte datos reales |

## Regla Para Nuevas Capacidades

Una nueva funcionalidad inteligente debe agregarse en este orden:

1. Capability con responsabilidad unica.
2. Intent(s) que la activan.
3. Slots requeridos y preguntas de aclaracion.
4. Skill implementada con schema, permisos, modulo, riesgo e idempotencia.
5. Pruebas de lenguaje natural.
6. Integracion en interfaz, job, API, webhook o agente.

No se permite crear logica IA privada en una pantalla o modulo si no existe una
Capability correspondiente.
