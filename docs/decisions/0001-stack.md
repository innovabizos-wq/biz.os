# 0001 - Stack Tecnologico

## Decision

biz.os usara Next.js App Router, TypeScript, Tailwind CSS, shadcn/ui, Supabase
Auth, PostgreSQL, Supabase RLS, Zod y Vercel.

## Justificacion

- Next.js App Router permite una aplicacion full-stack con rutas, layouts,
  server components y despliegue directo en Vercel.
- TypeScript mejora contratos entre modulos, servicios, validaciones y UI.
- Tailwind CSS permite velocidad y consistencia visual.
- shadcn/ui da componentes accesibles y editables dentro del proyecto.
- Supabase Auth integra identidad con PostgreSQL y RLS.
- PostgreSQL es una base solida para datos relacionales del ERP.
- Supabase RLS permite aislamiento fuerte por `empresa_id`.
- Zod valida entradas en formularios, actions y servicios.
- Vercel simplifica despliegue inicial de Next.js.

## Fuera Del Arranque

TanStack Query queda como opcion futura si aparece una necesidad clara de estado
cliente complejo.
