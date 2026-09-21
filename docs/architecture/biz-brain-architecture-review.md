# Biz.Brain: revision de arquitectura y vision objetivo

Fecha de revision: 2026-07-11

## Resumen ejecutivo

Biz.Brain no falla por falta de componentes. Falla porque existen demasiados
componentes parciales que resuelven partes similares sin compartir un runtime,
un estado conversacional ni un contrato unico de capacidades.

La base conceptual original es correcta: separar el core deterministico, la IA
operativa, la IA analitica y la ejecucion autorizada. La implementacion actual,
sin embargo, se dividio en tres caminos:

1. Capa conversacional: parser local, router con LLM, Action Registry y
   Execution Bridge.
2. Business Brain analitico: snapshots, senales, insights, recomendaciones y
   planes de un paso.
3. Brain Core nuevo: contratos, Tool Registry y Tool Executor que solo tienen
   herramientas de diagnostico y no gobiernan los dos caminos anteriores.

El resultado visible es coherente con esta fragmentacion: la barra parece un
chat, pero es un comando de un solo turno; el Brain parece conocer el negocio,
pero responde con un resumen reducido y potencialmente obsoleto; los planes
parecen un motor de procesos, pero son una secuencia lineal sin persistencia de
ejecucion real, reanudacion, idempotencia ni resolucion de parametros.

La recomendacion es convertir Biz.Brain en el Sistema Operativo de Inteligencia
Empresarial de Biz.OS. No es un chat: el chat es solamente una de sus interfaces.
La conversacion, los modulos, los analisis, las recomendaciones, los procesos y
los futuros agentes deben usar el mismo runtime, el mismo catalogo de Business
Skills, el mismo servicio de contexto, el mismo motor de politicas, el mismo
motor de ejecucion y la misma trazabilidad.

## Cambio de paradigma

La pregunta de producto no es "como hacer que el chat responda mejor". Es:

> Como hacer que cualquier parte de Biz.OS tenga inteligencia empresarial
> contextual, segura y accionable?

Biz.Brain debe operar aunque no exista una conversacion visible. Un modulo puede
solicitar analisis, una pantalla puede pedir una recomendacion, un evento puede
activar una evaluacion y un usuario puede usar lenguaje natural. Todas esas
entradas deben llegar al mismo Brain Runtime.

```text
CRM ----------- siguiente cliente con probabilidad de cierre ----+
Inventario ---- riesgo de ruptura -------------------------------+
Cotizaciones -- sugerencia de descuento -------------------------+
Dashboard ----- resumen diario ----------------------------------+--> Brain Runtime
WhatsApp ------ borrador contextual -----------------------------+
Barra --------- pregunta o instruccion ---------------------------+
Evento -------- cambio operativo que requiere evaluacion --------+
```

El runtime no pertenece a la barra, al dashboard ni al modulo Brain. Es
infraestructura transversal de la plataforma. Cada superficie decide como
presentar su resultado, pero no implementa inteligencia propia.

## Objetivos funcionales

Biz.Brain debe ser capaz de:

- entender preguntas e instrucciones
- consultar y navegar informacion autorizada de todo Biz.OS
- mantener contexto entre interacciones
- pedir aclaraciones cuando falten datos o existan ambiguedades
- explicar resultados con evidencia, frescura y enlaces
- sugerir mejoras y siguientes acciones
- ejecutar acciones autorizadas mediante Business Skills
- coordinar procesos de varios pasos con aprobaciones
- aprender preferencias declaradas y confirmadas de la empresa
- ofrecer inteligencia dentro de cada modulo, sin depender del chat
- coordinar especialistas futuros sin darles acceso directo a los modulos o a
  Supabase

La unidad de exito no es una respuesta. Es una tarea empresarial completa con
un resultado correcto, autorizado y trazable.

## Arquitectura actual

### Flujo de la barra global

```text
Usuario
  -> DashboardAiSearch
  -> atajos locales de UI
  -> /api/ai/conversation/execute
  -> parser local por expresiones regulares
  -> si no coincide: router LLM con JSON estricto
  -> Action Registry
  -> validacion de modulo + permisos + Zod
  -> confirmacion opcional
  -> handler de accion
  -> intento de auditoria
  -> mensaje corto en la misma barra
```

La barra no conserva una conversacion. Cada envio es independiente. No existe
un identificador de hilo, historial, mensajes de herramienta, referencias a
entidades ni continuidad despues de una aclaracion, excepto un token temporal
de confirmacion guardado en estado React.

### Flujo analitico de Business Brain

```text
Ejecucion manual
  -> generar_brain_insights_basicos()
  -> snapshot diario y reglas SQL
  -> collectBrainSignals() con conteos por modulo
  -> brain_signals + brain_insights + brain_recommendations
  -> respuesta LLM con metricas + top senales + top recomendaciones + memoria
  -> fallback deterministico si el proveedor falla
```

La pregunta no decide que informacion consultar. `answerBrainQuestion` siempre
carga el mismo paquete reducido: ultimo snapshot, hasta 10 senales, 5
recomendaciones y 5 memorias. Esto permite responder un estado general, pero no
investigar una pregunta concreta ni navegar relaciones entre clientes,
cotizaciones, ventas, pagos, inventario y conversaciones.

### Flujo de planes

```text
Recomendacion aprobada
  -> brain_action_plan
  -> un brain_plan_step con action_id + payload generico
  -> ejecucion secuencial por el Conversation Execution Bridge
  -> completed | failed | confirmation_required
```

No hay planificador que complete parametros, dependencias entre pasos,
condiciones, reintentos, compensaciones ni reanudacion de confirmaciones. En la
practica es un adaptador de una recomendacion a una accion, no un motor de
procesos.

### Brain Core nuevo

`src/modules/brain/core` define buenos contratos futuros para providers,
herramientas, agentes, conversaciones, memoria, conocimiento y ejecucion. Sin
embargo, hoy es una isla:

- El Tool Registry no contiene las acciones de negocio del Action Registry.
- El Tool Executor no es usado por la barra ni por los planes.
- Sus registros de ejecucion viven en memoria del proceso.
- Solo registra seis herramientas de sistema y diagnostico.
- El provider real sigue usando el contrato historico `generateJson`.

Por tanto, el Core agrega una segunda abstraccion sin retirar la anterior.

## Lo que si aporta valor

### A conservar

- `TenantContext` como frontera obligatoria de empresa, usuario, sucursal,
  modulos y permisos.
- RBAC, RLS y validacion de modulo activo antes de ejecutar capacidades.
- Schemas Zod por accion y handlers server-side.
- Separacion entre interpretar y ejecutar.
- Confirmacion para operaciones sensibles, aunque debe normalizarse.
- `business_context` como contexto declarado por la empresa.
- Analisis deterministico para calculos, estados y reglas verificables.
- Senales con evidencia y recomendaciones trazables.
- Configuracion cifrada del proveedor por empresa.
- Reutilizacion de servicios de dominio y RPC en lugar de permitir SQL libre al
  modelo.

### A mejorar, no eliminar

- Los conectores deterministas deben convertirse en herramientas de lectura
  reutilizables y consultables por tema, no ejecutarse solamente como un lote.
- Las recomendaciones deben conservarse, pero apuntar a propuestas de ejecucion
  tipadas y completas.
- Los planes deben evolucionar a ejecuciones durables y reanudables.
- La barra global debe evolucionar a una superficie conversacional persistente,
  no desaparecer.

## Hallazgos principales

### 1. El proveedor de IA no esta operativo de forma demostrada

En Supabase, `ai_provider` esta habilitado con Gemini y tiene una clave cifrada,
pero la ultima prueba registrada termino en error el 2026-06-27. Cuando la
llamada del proveedor falla, `answerBrainQuestion` captura cualquier error y
devuelve un fallback deterministico. Para el usuario esto se percibe como una
IA generica, aunque en realidad puede no estar interviniendo ningun modelo.

### 2. El contexto esta obsoleto y es demasiado superficial

El ultimo snapshot observado corresponde al 2026-06-30. La revision se realizo
el 2026-07-11. Tampoco existe una programacion del analisis; el estado
`scheduled` existe en el modelo, pero la generacion se dispara manualmente.

Ademas, el contexto conversacional se limita a agregados y titulos. No incluye
filas relevantes seleccionadas por la pregunta, rangos temporales solicitados,
comparaciones, fuentes ni enlaces a entidades.

### 3. No existe conversacion real

La UI muestra un input, una respuesta y un token de confirmacion. No guarda
hilos ni mensajes. Preguntas como "cuales?", "abre el segundo" o "hazlo para el
cliente anterior" no pueden resolverse de forma confiable porque el siguiente
turno no recibe el estado anterior.

### 4. El parser local domina demasiado el enrutamiento

Cualquier pregunta generica puede terminar en `brain.responder_pregunta` por
una expresion regular de captura. Esto evita una seleccion semantica de
herramientas y fuerza preguntas muy diferentes a usar el mismo resumen del
Brain. Mantener expresiones regulares para comandos inequivocos es util;
utilizarlas como router general no escala.

### 5. Hay dos catalogos de capacidades incompatibles

El Action Registry contiene las capacidades reales de negocio. El Tool Registry
contiene herramientas de sistema. Ambos definen permisos, modulo, schemas y
ejecucion, pero ninguno adapta al otro. Esta es la principal redundancia
arquitectonica.

### 6. Los planes no resuelven contratos de entrada

La conversion de una recomendacion crea un payload generico con
`recommendationId`, `source` y `summary`. Muchas acciones requieren `query`,
`items`, identificadores u otros campos. En los datos remotos ya existe un paso
fallido de `productos.buscar_producto` por parametros invalidos. El plan fue
creado sin asegurar que su payload cumpliera el schema de la accion.

### 7. La ejecucion no es durable

No hay un `run` persistido que represente cada intento de extremo a extremo. No
hay claves de idempotencia, bloqueo concurrente, numero de intento, heartbeat,
timeout, reanudacion ni compensacion. Una confirmacion pendiente queda dentro
del resultado JSON del paso, pero el flujo no ofrece un mecanismo completo para
reanudarla.

### 8. Riesgo y confirmacion no siguen una politica central

Cada accion declara `risk` y `requiresConfirmation` manualmente. Existen
escrituras de riesgo medio sin confirmacion. La politica deberia derivarse de
impacto, reversibilidad, destinatario externo, dinero, inventario y datos
sensibles, con excepciones explicitas y auditables.

### 9. La observabilidad declarada no existe en el camino real

`dailyLimit` se guarda, pero no se aplica en las llamadas al proveedor. Las
llamadas reales no registran tokens, costo, latencia, modelo, feature ni error en
`ai_usage_events`. El Tool Executor nuevo registra en un arreglo en memoria. Los
intentos de auditoria del bridge no comprueban el error de insercion y en la base
revisada no aparecen eventos `conversation_action`.

### 10. El adapter de proveedor es insuficiente

El adapter solo expone `generateJson` y `test`. La respuesta solo contiene
texto. No hay tool calls nativos, structured outputs tipados por schema,
streaming, usage, timeout, cancelacion, identificador de respuesta ni metadata
del proveedor. Incluso las respuestas naturales pasan por un metodo llamado
`generateJson`.

### 11. La superficie API esta duplicada

`/api/brain/{actions,dry-run,execute,confirm}` replica el flujo de
`/api/ai/conversation/*`. Mantener dos nombres para el mismo runtime aumenta el
costo de cambios y pruebas sin agregar una frontera funcional.

### 12. Las pruebas validan presencia, no comportamiento

La mayor parte de las pruebas inspecciona archivos con expresiones regulares.
Confirman que existen nombres y rutas, pero no que un usuario pueda completar
una tarea. La suite focalizada tiene una prueba fallida del parser y no cubre
conversaciones multi-turno, permisos reales, confirmaciones reanudables,
idempotencia, fallos del proveedor ni planes con schemas reales.

## Vision objetivo

Biz.Brain debe ser la infraestructura central de inteligencia de Biz.OS, con
cinco responsabilidades claras:

1. Entender la intencion y mantener el estado de la conversacion.
2. Construir contexto relevante y fresco desde datos autorizados.
3. Seleccionar Business Skills tipadas para consultar o actuar.
4. Ejecutar o proponer ejecuciones bajo politicas de riesgo y aprobacion.
5. Explicar resultados con evidencia, enlaces y trazabilidad.

No debe reemplazar la logica de dominio. Debe orquestarla.

```text
Superficies (modulos, barra, pagina Brain, eventos, API)
                         |
                         v
                 Brain Interaction API
                         |
                         v
                    Brain Runtime
       +-----------------+------------------+
       |                 |                  |
 Context Service  Business Skill Registry  Policy Engine
       |                 |                  |
       +-----------------+------------------+
                         |
                  Execution Engine
                         |
            Servicios/RPC de cada modulo
                         |
                 Supabase + integraciones

Transversal: conversaciones, aprobaciones, auditoria, usage, evals y trazas
```

## Componentes propuestos

### 1. Brain Interaction API

Una sola API para todos los canales internos. Debe aceptar `conversationId`,
mensaje, superficie, ruta, entidad enfocada y adjuntos futuros. Debe devolver
mensajes estructurados, propuestas de accion, solicitudes de datos,
aprobaciones, resultados y enlaces.

La barra global y la pagina Brain deben ser dos vistas del mismo hilo, no dos
motores diferentes.

### 2. Conversation Repository

Persistencia durable por empresa y usuario:

- `brain_conversations`
- `brain_messages`
- mensajes de usuario, asistente, herramienta y sistema
- metadata de superficie y entidades enfocadas
- resumen/compactacion para conversaciones largas
- estado abierto, archivado o cerrado

El proveedor puede usar estado propio cuando convenga, pero Supabase debe
mantener el registro canonico y auditable del producto.

### 3. Context Service

Debe construir contexto en dos capas:

- Base: empresa, usuario, sucursal, permisos, modulos, fecha, zona horaria y
  `business_context`.
- Bajo demanda: resultados de capacidades de lectura elegidas segun la pregunta.

No se debe enviar "toda la empresa" al modelo. El runtime primero decide que
consultas necesita, ejecuta herramientas de lectura y luego sintetiza con
evidencia. Cada dato presentado debe incluir frescura, fuente y, cuando exista,
un enlace a la entidad.

### 4. Business Skill Registry unico

Debe reemplazar tanto el Action Registry como el Tool Registry. Una Business
Skill es una capacidad empresarial atomica, tipada, autorizable y observable.
No es un prompt ni codigo que el modelo pueda improvisar.

Ejemplos:

- `crm.customer.search`
- `crm.customer.next_best`
- `catalog.product.search`
- `inventory.stock.query`
- `inventory.stockout.analyze`
- `quotes.draft.create`
- `payments.overdue.query`
- `inbox.reply.draft`
- `agenda.task.create`

Una skill define:

- identificador y version
- descripcion orientada al modelo y descripcion para UI
- schema de entrada y salida
- modulo y permisos
- tipo: query, analysis, command o draft
- impacto, reversibilidad y riesgo base
- necesidad de aprobacion
- idempotencia
- handler que llama un servicio de dominio

Las acciones actuales deben adaptarse gradualmente a este contrato. Durante la
transicion, un adapter puede exponer una `ConversationActionDefinition` como
`BusinessSkill`; no deben mantenerse dos listas manuales.

Los workflows no son skills gigantes. Son composiciones durables de varias
skills con dependencias, politicas y criterios de exito.

### 5. Module Intelligence API

Los modulos no deben simular una conversacion para usar el Brain. El runtime
debe exponer una API interna con tres formas de uso:

- `ask`: interpretar una pregunta y decidir que skills de lectura necesita
- `invoke`: ejecutar una skill conocida con entrada tipada
- `suggest`: obtener recomendaciones para un contexto o entidad concreta

Ejemplos conceptuales:

```text
brain.ask({ source: "dashboard", question: "Que cambio esta semana?" })
brain.invoke({ skillId: "crm.customer.next_best", input: { ownerId } })
brain.suggest({ source: "quotes", entityId: quoteId, goal: "improve_conversion" })
```

La API siempre recibe `TenantContext`, actor, superficie y contexto enfocado.
Esto permite integrar inteligencia en CRM, inventario, cotizaciones, dashboard
o WhatsApp sin crear una nueva capa de IA dentro de cada modulo.

### 6. Policy Engine

Resuelve en un solo lugar:

- tenant y usuario
- modulo activo
- permisos
- acceso a entidad
- riesgo efectivo
- confirmacion requerida
- limites de uso
- campos sensibles y redaccion
- Business Skills permitidas para cada futuro agente

El modelo nunca decide permisos. Solo propone llamadas; el Policy Engine las
autoriza o bloquea.

### 7. Provider Gateway

Contrato minimo:

- generacion de texto
- salida estructurada por schema
- tool calling
- streaming opcional
- timeout y cancelacion
- usage y metadata
- identificadores de respuesta
- manejo uniforme de errores y reintentos limitados

Para OpenAI, la arquitectura debe poder usar Responses API con function tools y
estado conversacional. Para otros proveedores, el gateway debe emular el mismo
contrato sin exponer particularidades al Brain Runtime.

### 8. Execution Engine

Un run durable contiene pasos, dependencias y estado. Cada paso debe soportar:

- payload validado antes de crear el plan
- idempotency key
- pending, running, waiting_input, waiting_approval, completed, failed, skipped
- intentos, timeout y error estructurado
- resultado tipado
- reanudacion
- auditoria
- compensacion opcional para acciones reversibles

Los procesos complejos se definen como workflows deterministas. La IA puede
proponer parametros o seleccionar un workflow, pero no improvisar reglas
transaccionales.

### 9. Observabilidad y evaluacion

Cada interaccion debe producir una traza con:

- conversation, run y step IDs
- modelo y proveedor
- latencia y tokens
- capacidades ofrecidas y llamadas
- decisiones de politica
- aprobaciones
- errores
- resultado final y feedback del usuario

Se necesitan evals de tareas reales, no solo pruebas de strings. Ejemplos:

- consultar ventas de un periodo y citar resultados correctos
- encontrar un cliente ambiguo y pedir aclaracion
- crear un cliente con confirmacion segun politica
- preparar una cotizacion de varios turnos
- reanudar un proceso despues de aprobacion
- bloquear una accion sin permiso
- recuperarse de un proveedor caido sin afirmar que uso IA

## Skills, workflows y agentes

La jerarquia futura debe ser explicita:

```text
Business Skill
  = una capacidad empresarial tipada

Workflow
  = una composicion durable de Business Skills

Agent Definition
  = instrucciones + Business Skills permitidas + politica + limites

Biz.Brain
  = orquestador principal, propietario del contexto, la politica y el run
```

Ejemplo de especialista comercial:

```text
Sales Agent
  -> crm.customer.search
  -> crm.customer.next_best
  -> catalog.product.search
  -> quotes.draft.create
  -> inbox.reply.draft
  -> agenda.availability.query
```

Ejemplo de especialista financiero:

```text
Finance Agent
  -> sales.summary.query
  -> billing.documents.query
  -> payments.overdue.query
  -> reports.financial.generate
```

No se deben implementar agentes todavia. Primero debe existir el runtime unico.
Cuando se agreguen, un agente sera una configuracion acotada del mismo runtime:

```text
AgentDefinition = instrucciones + Business Skills permitidas + politica + limites
```

Biz.Brain sera el manager que conserva la conversacion y la respuesta al
usuario. Un especialista podra ser invocado como skill especializada o recibir
un handoff. Ningun agente tendra acceso directo a Supabase; usara Business Skills
autorizadas. De esta manera se podran agregar especialistas de ventas, cobros,
inventario, soporte o facturacion sin cambiar el motor base.

## Que unificar, retirar o posponer

### Unificar

- Action Registry y Tool Registry -> Business Skill Registry.
- `/api/ai/conversation/*` y duplicados `/api/brain/*` -> Interaction API unica.
- auditoria de acciones, tool log y usage -> trazas de runs persistidas.
- configuracion historica de IA y Brain -> Provider Gateway por empresa.

### Retirar despues de migrar

- captura general de preguntas mediante regex.
- logs de herramientas en memoria.
- aliases de `brain/ai-service.ts` que solo reexportan la capa historica.
- endpoints duplicados.
- panel tecnico de JSON en la pagina operativa de Brain; debe quedar en una
  consola administrativa o de desarrollo.

### Mantener temporalmente

- parser local solo para comandos inequivocos y navegacion rapida.
- tablas actuales de insights, recomendaciones y planes mientras se introduce
  el nuevo modelo de runs.
- fallback deterministico, pero etiquetado como tal y basado en datos frescos.

### Posponer

- multiagente.
- memoria vectorial general.
- autopilot.
- ejecucion autonomica de alto riesgo.
- catalogo dinamico de agentes en base de datos.

## Ruta concreta para iniciar el cambio

El cambio debe comenzar con un corte vertical pequeno que demuestre el nuevo
paradigma: la misma Business Skill usada desde un modulo y desde la barra, bajo
el mismo runtime, sin duplicar logica y sin depender obligatoriamente de un LLM.

### Cambio 0: congelar expansion y crear linea base

Antes de mover arquitectura:

- no agregar nuevos parsers, prompts, endpoints Brain ni acciones paralelas
- corregir la conexion del proveedor o marcarlo explicitamente como no operativo
- registrar latencia, modelo, resultado y error de cada llamada actual
- crear cinco escenarios de aceptacion reproducibles con datos de prueba

Esto permite comparar el sistema actual con el nuevo sin evaluar por sensacion.

### Cambio 1: fundacion del Brain Runtime

Crear una frontera nueva sin eliminar aun el flujo anterior:

```text
src/modules/brain/runtime/
  contracts.ts
  brain-runtime.ts
  business-skill-registry.ts
  business-skill-executor.ts
  policy-engine.ts
  adapters/conversation-action-skill-adapter.ts
```

Contratos iniciales:

- `BrainRequest` y `BrainResponse`
- `BusinessSkillDefinition`
- `BusinessSkillInvocation`
- `BusinessSkillResult`
- `BrainActorContext`
- `BrainSourceContext`
- `BrainPolicyDecision`

El adapter debe convertir temporalmente las acciones actuales en Business Skills.
Asi se reutilizan handlers y schemas mientras se retiran las abstracciones
anteriores. La primera version del runtime solo necesita `invoke`; no necesita
agentes, memoria vectorial ni un loop autonomo.

### Cambio 2: primera vertical de skills de lectura

Migrar primero skills de bajo riesgo y alto uso:

- `crm.customer.search`
- `catalog.product.search`
- `inventory.stock.query`
- `sales.summary.query`

Cada skill debe tener entrada y salida tipadas, permisos, modulo, frescura,
evidencia y enlaces. Debe poder invocarse directamente desde un modulo sin usar
lenguaje natural.

Prueba de arquitectura:

1. CRM usa `crm.customer.search` desde su propia interfaz.
2. La barra interpreta "busca el cliente X" y usa la misma skill.
3. Ambos caminos producen el mismo resultado tipado y la misma traza.

Cuando esto funcione, el paradigma de Brain transversal queda demostrado.

### Cambio 3: entrada natural sobre el mismo runtime

Agregar `ask` al Brain Runtime. El modelo recibe solamente las Business Skills
permitidas para ese actor y selecciona llamadas tipadas. El parser local queda
restringido a navegacion y comandos totalmente inequivocos.

El LLM no ejecuta handlers ni conoce Supabase. Propone una invocacion; Policy
Engine y Business Skill Executor deciden y ejecutan.

### Cambio 4: integrar superficies de modulo

Agregar `suggest` y contextos enfocados para que los modulos consuman Brain sin
simular chat:

- CRM: siguiente mejor cliente y seguimientos prioritarios
- Inventario: riesgo de ruptura y sugerencias de reposicion
- Cotizaciones: riesgo de perdida y borrador de mejora
- Dashboard: resumen y cambios relevantes
- WhatsApp: resumen, intencion y borrador de respuesta

Cada integracion debe reutilizar skills existentes. No se permite crear un
servicio IA privado dentro del modulo.

### Cambio 5: conversacion durable

Solo despues de tener skills reales:

- persistir conversaciones y mensajes
- soportar aclaraciones y referencias a resultados anteriores
- convertir barra y pagina Brain en vistas del mismo estado
- guardar tool calls, resultados y evidencia como parte del hilo

### Cambio 6: procesos durables

Reemplazar gradualmente `brain_action_plans` como executor por runs y steps
reanudables. Los workflows compondran Business Skills ya probadas. Las primeras
automatizaciones deben ser internas, reversibles y de bajo riesgo.

### Cambio 7: agentes especializados

Crear agentes solo cuando el catalogo de skills, Policy Engine, conversaciones,
runs y evals esten operativos. El primer agente debe ser una configuracion de
skills existentes, no una nueva ruta de ejecucion.

### Primer entregable recomendado

El primer entregable implementable comprende Cambios 0, 1 y 2, limitado a
skills de lectura. No requiere migraciones destructivas ni cambios visuales
grandes. Su criterio de aceptacion es:

- existe un solo `BusinessSkillRegistry`
- el runtime puede invocar skills sin LLM
- permisos y modulos se validan centralmente
- CRM y la barra reutilizan al menos una misma skill
- cada invocacion genera una traza persistente o un registro verificable
- pruebas de comportamiento validan resultados, permisos y errores

## Hoja de ruta recomendada

### Fase 0: estabilizar y medir

- Corregir y verificar la conexion del proveedor.
- Registrar cada llamada real con latencia, modelo, usage y error.
- Aplicar timeout, limite diario y manejo de cancelacion.
- Hacer visible la frescura del snapshot.
- Programar el analisis deterministico o actualizar bajo demanda.
- Corregir auditoria y agregar pruebas de comportamiento para los flujos
  actuales.

Criterio de salida: se puede distinguir con evidencia una respuesta del modelo,
un fallback y un error; ninguna respuesta usa datos vencidos sin advertirlo.

### Fase 1: runtime y Business Skills unicas

- Crear `BusinessSkill` y adaptar las acciones actuales.
- Hacer que barra, Brain y planes usen el mismo executor.
- Eliminar la lista paralela de herramientas de negocio.
- Introducir Provider Gateway con tool calling y salida estructurada.

Criterio de salida: existe una sola ruta de autorizacion y ejecucion para cada
Business Skill.

### Fase 2: conversacion y contexto

- Persistir conversaciones y mensajes.
- Agregar seleccion de herramientas de lectura por pregunta.
- Respuestas con evidencia, frescura y enlaces.
- Soportar aclaraciones y referencias a turnos previos.
- Convertir la barra en una vista compacta y la pagina Brain en la vista
  expandida del mismo hilo.

Criterio de salida: un usuario puede completar tareas de varios turnos y
continuarlas entre pantallas.

### Fase 3: motor de ejecucion durable

- Runs y steps persistidos.
- aprobaciones reanudables
- idempotencia, reintentos y timeouts
- workflows deterministas para tareas multi-paso
- estado y timeline visibles al usuario

Criterio de salida: un proceso puede pausarse, aprobarse y continuar sin perder
estado ni duplicar efectos.

### Fase 4: especialistas

- Introducir un primer especialista de bajo riesgo como configuracion del
  runtime.
- Evaluar manager con especialistas como tools antes de usar handoffs abiertos.
- Agregar guardrails y evals por especialista.

Criterio de salida: agregar un especialista no requiere cambiar el Conversation
Repository, Business Skill Registry, Policy Engine ni Execution Engine.

## Metricas de exito

- porcentaje de tareas empresariales completadas de extremo a extremo
- cobertura de Business Skills por proceso y modulo
- tasa de seleccion correcta de skill
- porcentaje de modulos que consumen el Brain Runtime sin logica IA propia
- tareas completadas por tipo, no solo mensajes enviados
- numero medio de aclaraciones necesarias
- tasa de errores y recuperacion por proveedor
- aprobaciones aceptadas, rechazadas y expiradas
- ejecuciones duplicadas: objetivo cero
- respuestas con datos frescos y evidencia
- latencia p50/p95 y costo por tarea completada
- feedback util/no util por respuesta

## Decision recomendada

No continuar agregando prompts, parsers o agentes sobre la arquitectura actual.
Primero se debe ejecutar Fase 0 y Fase 1. El activo mas importante ya existe:
los servicios de dominio, permisos y datos de biz.os. El trabajo ahora es crear
un runtime unico que los convierta en Business Skills seguras, observables y
conversacionales.

La meta de Biz.Brain no debe medirse por cuantas preguntas puede contestar, sino
por cuantas tareas empresariales puede comprender, explicar y completar de forma
correcta bajo la autoridad del usuario.

## Estado de implementacion del primer entregable

Implementado el 2026-07-11:

- Brain Runtime invocable sin LLM
- Business Skill Registry unico para la nueva vertical
- Policy Engine central con tenant, modulo activo y permisos
- Business Skill Executor con schemas de entrada y salida
- trazas estructuradas sin payloads sensibles
- adapter temporal desde acciones conversacionales heredadas
- skills `crm.customer.search`, `catalog.product.search`,
  `inventory.stock.query` y `sales.summary.query`
- CRM y barra reutilizan `crm.customer.search`
- timeout, latencia, usage y estado para proveedores de IA
- marca explicita `model` o `deterministic_fallback` en respuestas Brain
- pruebas ejecutables de registry, permisos, validacion y ejecucion

No se crearon ni modificaron tablas. La conexion real del proveedor continua
pendiente de una prueba exitosa con las credenciales configuradas por la empresa.
