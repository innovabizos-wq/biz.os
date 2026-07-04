# Business Brain

Business Brain es la capa conceptual de inteligencia empresarial de biz.os.
No es un chatbot, una pantalla, una automatizacion ni un agente que ejecuta
tareas. Es el modelo que interpreta el estado operativo de una empresa a partir
de sus datos reales, su contexto de negocio y sus reglas internas.

Su objetivo es convertir informacion dispersa en entendimiento accionable:
riesgos, oportunidades, anomalias, prioridades, recomendaciones y, en fases
futuras, planes que puedan ser ejecutados por agentes controlados.

Business Brain debe respetar siempre el aislamiento multiempresa. Cada Brain
pertenece a una sola empresa, opera sobre datos de esa empresa y nunca mezcla
clientes, ventas, inventario, pagos, conversaciones, agenda ni contexto entre
tenants.

## Componentes Conceptuales

### Core Operativo

El Core Operativo es la parte deterministica de biz.os. Incluye reglas,
validaciones, permisos, modulos activos, flujos transaccionales, calculos,
estados y auditoria.

Ejemplos:

- Calcular totales de una cotizacion.
- Bloquear un sobrepago.
- Validar permisos antes de una Server Action.
- Reservar, descontar o consultar inventario.
- Resolver `empresa_id` desde la sesion.
- Determinar si una venta esta pendiente, pagada o despachada.

El Core Operativo no debe depender de IA para funcionar.

### IA Operativa

IA Operativa asiste tareas dentro de flujos de trabajo concretos. Puede redactar,
clasificar, resumir, sugerir respuestas o preparar contenido, pero no reemplaza
las reglas del Core Operativo.

Ejemplos:

- Redactar una respuesta sugerida para Whapp.
- Resumir una conversacion antes de crear un seguimiento.
- Generar texto comercial para una cotizacion.
- Ayudar a completar una descripcion de producto.

La IA Operativa trabaja cerca del usuario y requiere confirmacion humana cuando
afecta comunicacion, datos o decisiones relevantes.

### IA Analitica

IA Analitica interpreta patrones, tendencias y relaciones entre datos. Su salida
principal son insights, explicaciones y recomendaciones. No ejecuta acciones por
si misma.

Ejemplos:

- Detectar que un vendedor pierde oportunidades despues de cierto tiempo sin
  seguimiento.
- Identificar productos con alta demanda y bajo inventario.
- Explicar por que suben las cotizaciones sin conversion.
- Priorizar clientes con mayor probabilidad de compra.

Business Brain vive principalmente en esta capa.

### Agent Executor

Agent Executor es una capa futura de ejecucion controlada. Su responsabilidad
sera tomar una recomendacion aprobada o una tarea autorizada y convertirla en
acciones concretas dentro de biz.os o herramientas externas.

Ejemplos futuros:

- Crear seguimientos.
- Preparar borradores de mensajes.
- Generar tareas operativas.
- Ejecutar secuencias aprobadas.
- Llamar herramientas tecnicas como Codex para cambios controlados.

Agent Executor no debe decidir por si solo que conviene hacer. Debe recibir
objetivos, limites, permisos, riesgo y autorizacion desde el Brain y el usuario.

### Autopilot

Autopilot es una capacidad futura donde biz.os ejecuta acciones de bajo riesgo
con poca o ninguna intervencion humana, siguiendo politicas preaprobadas.

Autopilot no es el Brain. Es una forma de ejecucion. Depende de que el Brain ya
entienda el negocio, tenga criterios de riesgo, historial de resultados,
recomendaciones trazables y limites claros.

## Regla Principal

Si puede resolverse con logica, no usar IA.

La IA no debe usarse para reemplazar:

- Validaciones transaccionales.
- Calculos exactos.
- Permisos.
- RLS.
- Estados de documentos.
- Reglas fiscales o contables deterministicas.
- Activacion de modulos.
- Resolucion de empresa.
- Integridad de inventario, pagos o ventas.

Primero se implementa logica clara, testeable y auditable. La IA se usa solo
cuando el problema requiere interpretacion, lenguaje natural, priorizacion,
patrones difusos o juicio contextual.

## Por Que Autopilot No Debe Construirse Antes Del Brain

Construir Autopilot antes del Brain crearia automatizacion sin criterio
empresarial. Eso aumenta el riesgo de ejecutar acciones correctas tecnicamente
pero equivocadas para el negocio.

Autopilot necesita antes:

- Datos confiables por empresa.
- Contexto de negocio actualizado.
- Historial operativo suficiente.
- Reglas de riesgo.
- Estados de recomendacion.
- Auditoria de decisiones.
- Separacion entre sugerir, aprobar y ejecutar.
- Capacidad de explicar por que se propone una accion.

Sin Brain, Autopilot seria solo una coleccion de automatizaciones aisladas. Con
Brain, Autopilot puede operar como extension controlada de una estrategia
empresarial entendida por biz.os.

## Datos Que Consume

Business Brain consume datos operativos y contexto transversal. El consumo debe
ser por empresa y bajo los mismos principios de permisos, RLS y modulos activos
del resto de biz.os.

### CRM

- Clientes, prospectos y datos de contacto.
- Etapas, estado comercial y origen.
- Interacciones, notas y seguimientos.
- Historial de relacion con la empresa.

### Ventas

- Ventas creadas, confirmadas, canceladas o completadas.
- Montos, margenes cuando existan, frecuencia y conversion.
- Relacion entre vendedor, cliente, producto y resultado.
- Ciclo entre cotizacion, venta, pago y despacho.

### Cotizaciones

- Cotizaciones abiertas, vencidas, aprobadas o perdidas.
- Items, descuentos, totales y condiciones.
- Tiempo hasta conversion.
- Motivos de perdida cuando existan.

### Inventario

- Existencias, disponibilidad y movimientos.
- Productos con baja rotacion o alta demanda.
- Riesgos de quiebre.
- Relacion entre inventario y ventas/cotizaciones.

### Pagos

- Cuentas por cobrar.
- Pagos parciales, completos o vencidos.
- Riesgo de mora.
- Relacion entre cobranza, cliente y flujo comercial.

### Agenda

- Seguimientos pendientes, vencidos y completados.
- Carga de trabajo por usuario.
- Compromisos con clientes.
- Actividad comercial planificada.

### Whapp

- Conversaciones, mensajes, asignaciones y tiempos de respuesta.
- Estado de atencion.
- Vinculo con clientes CRM.
- Senales de urgencia, interes, queja o abandono.

### business_context

- Identidad y tono de la empresa.
- Reglas comerciales y operativas.
- Mercado, diferenciadores y publico objetivo.
- Limites, temas prohibidos, disclaimers e instrucciones para IA.

`business_context` no reemplaza los datos operativos. Les da significado.

## Insights Que Debe Generar

Un insight describe algo que esta ocurriendo o podria ocurrir. Debe ser
explicable, trazable y, cuando sea posible, vinculado a datos fuente.

Tipos esperados:

- Oportunidades comerciales: clientes con alta probabilidad de compra, productos
  con demanda creciente o cotizaciones cercanas a convertir.
- Riesgos operativos: quiebres de inventario, seguimientos vencidos,
  conversaciones sin respuesta o ventas sin pago.
- Anomalias: cambios inusuales en conversion, ticket promedio, tiempos de
  respuesta, cancelaciones o descuentos.
- Rendimiento: comparacion por vendedor, canal, producto, sucursal o periodo.
- Friccion de proceso: pasos donde se pierden clientes, se atrasan pagos o se
  acumulan tareas.
- Calidad de datos: clientes duplicados, telefonos invalidos, registros
  incompletos o ventas sin informacion clave.
- Senales de cliente: interes, urgencia, objeciones frecuentes, quejas o riesgo
  de abandono.

## Recomendaciones Que Debe Generar

Una recomendacion propone una accion o decision. Debe indicar el motivo, el
impacto esperado, el riesgo, los datos usados y si puede ejecutarse manualmente o
por un agente futuro.

Tipos esperados:

- Comerciales: contactar un cliente, reabrir una cotizacion, ajustar una oferta
  o priorizar un prospecto.
- Operativas: crear seguimientos, reasignar conversaciones, revisar atrasos o
  ordenar tareas por urgencia.
- Inventario: reponer productos, revisar baja rotacion, bloquear venta de items
  criticos o sugerir alternativas.
- Cobranza: priorizar cuentas vencidas, preparar recordatorios o escalar casos.
- Atencion: responder conversaciones atrasadas, detectar clientes molestos o
  preparar resumen antes de continuar.
- Gerenciales: revisar rendimiento por area, ajustar reglas, cambiar metas o
  investigar tendencias.
- Calidad de datos: fusionar duplicados, completar informacion o normalizar
  campos.

## Estados De Una Recomendacion

Estados conceptuales:

- `draft`: recomendacion generada pero no lista para accion.
- `suggested`: recomendacion visible para revision humana.
- `reviewing`: usuario o responsable la esta evaluando.
- `approved`: aprobada para ejecucion manual o futura ejecucion asistida.
- `rejected`: descartada con o sin motivo.
- `scheduled`: aprobada y programada para un momento futuro.
- `executing`: en ejecucion por usuario, flujo interno o Agent Executor futuro.
- `completed`: accion terminada.
- `failed`: ejecucion intento completarse pero fallo.
- `cancelled`: detenida antes de completarse.
- `expired`: ya no aplica por tiempo, cambio de datos o cambio de contexto.

Estos estados no implican tablas todavia. Definen el lenguaje comun para una
implementacion futura.

## Niveles De Riesgo Para Ejecucion Futura

Todo paso hacia ejecucion automatizada debe clasificar riesgo.

- `low`: accion reversible o de bajo impacto. Ejemplo: crear una tarea interna o
  preparar un borrador.
- `medium`: accion que afecta operacion o comunicacion, pero con impacto
  controlado. Ejemplo: programar un seguimiento, reasignar una conversacion o
  sugerir un mensaje listo para enviar.
- `high`: accion que puede afectar dinero, inventario, clientes o cumplimiento.
  Ejemplo: aplicar descuentos, cambiar estados comerciales, enviar mensajes a
  clientes o modificar condiciones de venta.
- `critical`: accion que afecta integridad financiera, fiscal, legal, permisos,
  seguridad, datos sensibles o configuracion de plataforma. Debe requerir
  aprobacion explicita y, en muchos casos, no ser automatizable.

Autopilot solo podria operar inicialmente en acciones `low` y casos muy
controlados de `medium`. Acciones `high` y `critical` requieren control humano,
auditoria y reglas explicitas.

## Relacion Futura Con Agent Executor Y Codex

Business Brain decide que conviene observar, recomendar o planificar. Agent
Executor ejecuta tareas autorizadas. Codex puede ser una herramienta tecnica
invocada por Agent Executor para cambios de codigo, documentacion, pruebas o
operaciones de desarrollo, siempre bajo limites claros.

Relacion conceptual:

```text
Datos operativos + business_context
        -> Business Brain
        -> Insight
        -> Recomendacion
        -> Aprobacion / politica
        -> Agent Executor
        -> Herramientas internas / Codex / integraciones futuras
```

Codex no debe recibir acceso directo e ilimitado al negocio ni ejecutar cambios
sin contexto. En una fase futura, el Brain deberia entregar a Agent Executor:

- Objetivo.
- Alcance por empresa.
- Datos relevantes.
- Restricciones.
- Nivel de riesgo.
- Estado de aprobacion.
- Criterios de exito.
- Reglas de auditoria.

La meta es que biz.os pueda pasar de entender el negocio a recomendar acciones y
despues a ejecutar tareas controladas, sin romper la separacion entre logica,
inteligencia, autorizacion y ejecucion.
