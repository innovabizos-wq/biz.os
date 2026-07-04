# Business Brain y Capa Conversacional

## Responsabilidades

La Capa Conversacional es la entrada natural del usuario. Recibe el mensaje de la barra IA, intenta resolver acciones simples con parser local y, cuando necesita interpretacion abierta, usa el proveedor configurado. No decide estrategia de negocio: convierte lenguaje natural en una accion registrada y la manda al Execution Bridge.

Business Brain es el analista del negocio. Lee datos reales por `empresa_id`, genera senales, insights, recomendaciones y planes accionables. Puede proponer acciones, pero no ejecuta por fuera del Action Registry.

El Execution Bridge es el ejecutor seguro. Valida tenant, modulo activo, permisos, payload, confirmacion y auditoria. Toda accion que venga de la barra o de Brain debe pasar por el mismo registro.

## Flujo

1. La barra envia `message`, `source`, `target`, `brainContext`, `recommendationId` o `planId`.
2. El parser local detecta acciones frecuentes o preguntas estrategicas.
3. Si el mensaje es estrategico, se enruta a `brain.responder_pregunta` o `brain.generar_analisis`.
4. Brain lee conectores server-side, genera senales y recomendaciones validadas con Zod.
5. Una recomendacion aprobada crea un plan en `brain_action_plans` con pasos en `brain_plan_steps`.
6. La ejecucion de planes llama al mismo Execution Bridge paso por paso.
7. Auditoria guarda origen, mensaje original, accion, recomendacion, plan, estado y resultado.

## Regla de seguridad

Brain recomienda y planifica. La Capa Conversacional interpreta. El Action Registry define lo permitido. El Execution Bridge ejecuta. Ninguna capa debe saltarse `empresa_id`, permisos o confirmacion.
