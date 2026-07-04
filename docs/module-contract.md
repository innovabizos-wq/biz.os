# Module Contract

Regla unica:

`MODULO ACTIVO + PERMISO DEL USUARIO = ACCESO`

## Core

Modulos core:

- `admin`, `crm`, `agenda`, `quotes`, `catalog`, `sales`, `inventory`, `dispatch`, `hr`.

Contrato:

- No se pueden desactivar desde UI.
- Deben mostrarse como base/madre.
- `isModuleActive` los trata como activos aunque falte o exista una fila inactiva en `empresa_modulos`.
- Server Actions igualmente deben validar permisos.

## Opcionales

Modulos opcionales:

- `billing`, `whapp`, `reports`, `autoblog`, `ai`, `purchases`, `payments`, `mobile`.

Contrato:

- Si estan inactivos, no deben aparecer en navegacion.
- Si estan inactivos, deben bloquear URL directa con estado humano.
- Si estan inactivos, las Server Actions deben bloquear mutaciones.
- Desactivar no borra datos.
- Activar puede asignar permisos base a roles sistema segun migracion `0045`.

Nota de alcance:

- La activacion de un modulo dentro del tenant no equivale a provision tecnica
  global. Whapp, IA y Facturacion pueden requerir configuracion de Platform Admin
  aunque el modulo este activo para la empresa.
- `/admin/modulos` es operacion del cliente sobre su propia empresa.
- `/platform` es operacion SaaS interna de AInovaCR/biz.os y no debe depender de
  permisos tenant.

## Health

`empresa_modulo_health` describe estado operativo:

- `healthy`: configuracion suficiente.
- `misconfigured`: activo pero faltan claves, secretos o setup.
- `inactive`: modulo opcional apagado.
- `unhealthy`: ultimo error o integracion no operativa.

## Dependencias Blandas

Las dependencias blandas no deben activar modulos automaticamente. Sirven para
explicar flujo y health:

- `sales` depende operativamente de `quotes`, `inventory`, `dispatch`, `payments`.
- `purchases` depende operativamente de `inventory` y `payments`.
- `whapp` depende de `crm`.
- `autoblog` puede usar `ai`, pero no debe requerir IA central para operar manualmente.

## Business Brain, Agent Executor Y Autopilot

Business Brain, Agent Executor y Autopilot son conceptos de arquitectura futura.
No cambian todavia el contrato de modulos, permisos, rutas ni activacion por
empresa.

Business Brain debera respetar el mismo aislamiento multiempresa: todo insight,
recomendacion o plan se calcula dentro de una sola empresa y a partir de datos
permitidos para esa empresa.

Regla principal: si un comportamiento puede resolverse con logica
deterministica, no debe delegarse a IA. Permisos, RLS, estados, calculos,
validaciones, pagos, inventario y reglas fiscales pertenecen al Core Operativo.

Autopilot no debe implementarse antes de Business Brain. Cualquier ejecucion
futura requiere recomendaciones trazables, niveles de riesgo, aprobacion y
auditoria.

Documento conceptual:

```text
docs/architecture/business-brain.md
```
