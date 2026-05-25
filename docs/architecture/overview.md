# Arquitectura General De biz.os

biz.os se construye como un SaaS multiempresa con aislamiento fuerte por
empresa. La base tecnica usa Next.js App Router, TypeScript, Tailwind CSS,
shadcn/ui, Supabase Auth, PostgreSQL, Supabase RLS y Zod.

## Separacion Principal

- `src/app`: rutas, layouts y composicion de pantallas.
- `src/modules`: logica por dominio del nucleo SaaS.
- `src/components/ui`: componentes base de shadcn/ui.
- `src/components/layout`: estructura visual general.
- `src/components/shared`: componentes reutilizables no ligados a dominio.
- `src/lib`: utilidades transversales internas.
- `src/services`: adaptadores para integraciones externas futuras.
- `src/database`: migraciones, policies, seeds y tipos.
- `docs`: decisiones tecnicas y arquitectura.

## Nucleo Inicial

El nucleo inicial cubre auth, tenant, empresas, sucursales, users/profiles,
roles, permissions, platform-modules, plans y audit.

Los modulos operativos futuros quedan documentados, pero no se crean como
carpetas hasta que se implementen.

## Orden Tecnico

```text
Auth -> Profile -> Empresa activa -> RLS -> Roles/permisos -> Modulos activos -> Planes -> Auditoria -> CRM
```
