# Auditoria RPC SECURITY DEFINER

Fecha de revision: 2026-06-05
Proyecto Supabase: `biz-os-dev` (`ctunnyqmgbpuyxdnwzgq`)

## Resumen

Supabase Advisor aun reporta funciones `SECURITY DEFINER` ejecutables por usuarios autenticados. Esto no significa automaticamente que esten rotas: en biz.os muchas RPC son el API transaccional autorizado. Si queda asi, debe estar documentado y auditado.

Conteo vivo:

- `SECURITY DEFINER` ejecutables por `authenticated`: `103`
- Todas validan `auth.uid()`: `103`
- Validan empresa o permiso de perfil con `current_empresa_id()` o
  `profile_has_permission(...)`: `99`
- Validan permiso con `current_user_has_permission(...)` o
  `profile_has_permission(...)`: `95`
- Validan modulo activo o equivalente: `4`
- Tocan terminos de secretos y siguen expuestas a `authenticated`: `2`

## Resumen De Excepciones

| Excepcion | Total | Comentario |
| --- | ---: | --- |
| Sin validacion explicita de permiso | 9 | Helpers de contexto, onboarding, invitaciones y notificaciones propias. |
| Sin validacion explicita de empresa | 4 | Flujos previos a empresa activa o helpers que derivan empresa por usuario. |
| Con terminos de secretos aun expuestos a `authenticated` | 2 | No deben retornar secretos completos; requieren vigilancia contractual. |

## RPC Sin Validacion Explicita De Permiso

Estas funciones no contienen `current_user_has_permission(...)` en su definicion. Algunas son justificables porque son de contexto, notificaciones propias u onboarding, pero deben quedar en allowlist explicita.

- `aceptar_invitacion_usuario(...)`
- `bootstrap_empresa_inicial(...)`
- `contar_mis_notificaciones_no_leidas()`
- `crear_notificacion_propia(...)`
- `current_empresa_id()`
- `current_user_has_permission(...)`
- `marcar_notificacion_leida(...)`
- `marcar_todas_mis_notificaciones_leidas()`
- `obtener_mis_notificaciones(...)`

## RPC Sin Validacion Explicita De Empresa

Estas funciones no contienen `current_empresa_id()` en su definicion. Deben revisarse individualmente porque algunas operan antes de tener empresa activa o derivan empresa desde otro helper.

- `aceptar_invitacion_usuario(...)`
- `bootstrap_empresa_inicial(...)`
- `crear_notificacion_propia(...)`
- `current_user_has_permission(...)`

## RPC Que Tocan Secretos

Estas son prioridad alta de seguimiento porque pasan cerca de configuracion
sensible. Ambas validan `auth.uid()`, empresa y permiso; no deben retornar
secretos completos al navegador.

- `obtener_inbox_canal_meta_estado(...)`
- `guardar_configuracion_fiscal(...)`

Las RPC legacy de escritura/lectura de secretos Meta completos ya no son
ejecutables por `authenticated` despues de `0041` y `0047`:

- `obtener_inbox_whatsapp_send_config(...)`
- `guardar_inbox_canal_meta_secretos(...)`
- `regenerar_inbox_canal_verify_token(...)`

Sus reemplazos server-only usan `service_role` desde wrappers marcados
`server-only`.

## Politica Objetivo

Cada RPC expuesta a `authenticated` debe caer en una de estas categorias:

- `public_user_api`: llamada directa desde server actions de usuario, valida `auth.uid`, empresa, permiso y modulo cuando aplique.
- `context_helper`: helper de contexto, read-only, sin mutaciones de negocio.
- `self_service`: acciones del propio usuario como notificaciones o invitacion aceptada.
- `server_only`: debe revocarse de `authenticated` y usarse solo con `service_role`.
- `internal_only`: debe moverse fuera del schema expuesto o revocarse del API.

## Orden Recomendado De Cierre

1. Crear allowlist documentada de RPC `public_user_api`.
2. Clasificar notificaciones propias como `self_service` y confirmar que filtran por `auth.uid`.
3. Revisar las 4 RPC de secretos y separar lectura de estado vs lectura de credenciales.
4. Agregar validacion de modulo activo a RPC de cada modulo opcional.
5. Mover helpers internos a schema no expuesto o revocar `EXECUTE` directo.
6. Activar leaked password protection de Supabase Auth antes de produccion.
7. Repetir Advisor hasta que los warnings restantes sean solo allowlist aceptada.

## Estado Actual Aceptable Para Desarrollo

Para `biz-os-dev`, el estado actual es aceptable para continuar pruebas controladas porque:

- `anon` no ejecuta RPC `SECURITY DEFINER`.
- Las RPC de webhook Meta ya son `service_role`.
- No hay RLS sin politica.
- No hay FKs sin indice segun la ultima consulta especifica.

No es cierre final de produccion hasta completar la allowlist y el hardening de secretos.
No es cierre final de produccion mientras Supabase Auth mantenga leaked password
protection desactivado.
