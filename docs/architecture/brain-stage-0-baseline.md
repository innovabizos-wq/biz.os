# Brain — línea base de la arquitectura central

Fecha de corte: 2026-08-15

## Resultado de la auditoría

- TypeScript: sin errores (`npm.cmd run typecheck`).
- Suite existente: 173 de 176 pruebas pasan. Las tres fallas de línea base pertenecen a allowlists/service-role, una etiqueta acentuada de CRM y separación de Platform Console; no pertenecen al runtime de Brain.
- Cobertura declarada: 280 capacidades objetivo y más de 500 Skills de agente ya implementadas o generadas sobre consultas reales.
- Interfaces encontradas: barra global, página Brain, jobs, webhooks, APIs, análisis, recomendaciones y workflows.
- Persistencia previa: métricas, señales, memoria, recomendaciones y planes; no existía un hilo canónico de conversación ni un registro general de mensajes, pasos, aprobaciones y feedback.

## Causa raíz

La capacidad de negocio sí existe, pero está detrás de cuatro rutas de ejecución paralelas: Action Registry legado, parser conversacional, Tool Registry aislado y Business Skill Runtime. La barra usa primero reglas rígidas y solo permite al modelo devolver un identificador exacto. No entrega al modelo herramientas ejecutables, no conserva el historial completo y deriva preguntas abiertas a una Skill genérica que devuelve señales. Por eso más configuración o más Skills no mejoraban la comprensión.

## Corte de aceptación

El salto se considera válido cuando:

1. barra y `/brain` usan `/api/brain/chat` y el mismo `conversationId` persistente;
2. el modelo recibe un conjunto dinámico de Skills autorizadas como tools reales;
3. las consultas usan evidencia y las mutaciones pasan por política, aprobación e idempotencia;
4. una ejecución puede reintentarse o reanudarse sin duplicar efectos;
5. el corpus de 250 frases mantiene disponible la capacidad esperada;
6. cada run deja mensajes, pasos, eventos, uso y aprobación auditables.

El archivo `src/modules/brain/evals/semantic-corpus.ts` es la línea base semántica ejecutable. No contiene nombres técnicos que el usuario deba memorizar: incluye variaciones naturales sobre CRM, catálogo, inventario, ventas, cotizaciones, cobros, compras, despachos, Inbox y contenido.
