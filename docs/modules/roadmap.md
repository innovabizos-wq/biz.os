# Roadmap De Modulos

Estos modulos forman parte de la vision de biz.os, pero no se crean como
carpetas hasta que se implementen.

Actualmente existen catalogos tipados de codigos para modulos, permisos y
planes. Eso no significa que los modulos operativos esten implementados.

## Modulos Futuros

- CRM
- llamadas
- WhatsApp
- seguimientos
- agenda
- cotizaciones
- ventas
- facturacion
- inventario
- logistica
- despacho
- rutas
- dashboards
- reportes automaticos
- gestion de calidad IA
- Business Brain / IA central
- Agent Executor
- Autopilot

## Regla De Implementacion

Cada modulo futuro debe respetar `empresa_id`, permisos backend, modulos activos,
planes y auditoria cuando aplique.

## Business Brain

Business Brain es una arquitectura conceptual futura, no un modulo implementado
todavia. Su funcion sera interpretar datos de CRM, ventas, cotizaciones,
inventario, pagos, agenda, Whapp y `business_context` para producir insights y
recomendaciones por empresa.

Regla base: si puede resolverse con logica deterministica, no se debe usar IA.
La IA queda para interpretacion, lenguaje natural, patrones difusos,
priorizacion y juicio contextual.

Autopilot no debe construirse antes del Brain. Primero se necesita entender el
negocio, clasificar riesgos, explicar recomendaciones y separar sugerencia,
aprobacion y ejecucion.

Documento conceptual:

```text
docs/architecture/business-brain.md
```
