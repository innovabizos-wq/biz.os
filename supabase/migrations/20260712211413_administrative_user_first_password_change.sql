alter table public.profiles
  add column if not exists requiere_cambio_contrasena boolean not null default false;

comment on column public.profiles.requiere_cambio_contrasena is
  'Bloquea el acceso operativo hasta que un usuario creado por un administrador cambie su contrasena temporal.';
