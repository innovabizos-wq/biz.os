# RRHH Planillas

Planillas registra estados laborales diarios por usuario y empresa. El objetivo
es alimentar una planilla operativa con cambios como Login, Almuerzo, Regreso de
almuerzo, Pausa, Breaks, Descanso activo, Salida y estados personalizados.

## Modelo

La migracion correctiva `database/migrations/0016b_rrhh_planillas_profesional.sql`
agrega o corrige:

- `rrhh_planilla_estados`: catalogo configurable por empresa.
- `rrhh_planilla_eventos`: eventos diarios congelando codigo y nombre del estado.
- Permisos `hr.timesheets.view`, `hr.timesheets.manage`,
  `hr.timesheets.register`, `hr.timesheets.dashboard` y
  `hr.timesheets.states.manage`.
- Modulo `hr` / RRHH.

Ningun formulario envia `empresa_id`. Las RPCs resuelven empresa y usuario desde
`auth.uid()` y `current_empresa_id()`.

## RPCs

- `inicializar_rrhh_planilla_estados_empresa()`
- `registrar_rrhh_planilla_estado(p_estado_codigo, p_notas)`
- `obtener_rrhh_estado_actual_usuario()`
- `obtener_rrhh_planilla_dashboard(p_fecha)`
- `crear_rrhh_planilla_estado(...)`
- `actualizar_rrhh_planilla_estado(...)`
- `cambiar_estado_rrhh_planilla_estado(p_estado_id, p_activo)`

Todas son `SECURITY DEFINER`, usan `search_path` controlado, validan permisos y
registran auditoria en mutaciones.

## Rutas

- `/rrhh/planillas`: estado actual, acciones de registro y eventos del dia.
- `/rrhh/planillas/dashboard`: dashboard operativo de colaboradores.
- `/rrhh/planillas/estados`: configuracion de estados laborales.

El dashboard general sigue siendo `/dashboard`.

## Sidebar

El widget inferior del sidebar muestra el estado actual del usuario, el nombre
visible y una accion principal para cambiar estado. Las opciones se agrupan en
un menu compacto para evitar botones amontonados. Tambien expone el acceso al
dashboard operativo cuando el usuario tiene permisos.

## Prueba Manual

1. Aplicar manualmente la migracion `0016b` en Supabase SQL Editor.
2. Entrar como administrador.
3. Abrir `/rrhh/planillas/estados`.
4. Ejecutar `Inicializar estados base`.
5. Activar o desactivar estados.
6. Registrar `Login` desde el sidebar.
7. Registrar `Almuerzo`.
8. Registrar `Regreso de almuerzo`.
9. Abrir `/rrhh/planillas/dashboard`.
10. Verificar KPIs y tabla de colaboradores.
