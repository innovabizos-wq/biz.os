# 0002 - Multiempresa Con Aislamiento Fuerte

## Decision

biz.os sera multiempresa con aislamiento fuerte. Cada empresa tendra usuarios y
datos propios, sin compartir informacion operativa con otras empresas.

## Reglas

- Un usuario operativo pertenece a una sola empresa.
- Toda tabla sensible futura incluye `empresa_id`.
- `empresa_id` se resuelve desde sesion/profile, no desde el frontend.
- Los roles pertenecen a una empresa.
- Los modulos activos se definen por empresa.
- Los planes se asignan por empresa.
- El superadmin de plataforma queda separado de `profiles`.

## Consecuencia

El sistema reduce ambiguedad de tenant y evita selectores de empresa para
usuarios normales. RLS, backend y permisos deben reforzar la misma frontera.
