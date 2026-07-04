-- Platform Console base.
-- Local migration only. Do not apply automatically from the app.
-- To enable the first SaaS operator, insert a profile_id manually:
-- insert into public.platform_users (profile_id, role, notes)
-- values ('00000000-0000-0000-0000-000000000000', 'owner', 'Primer Platform Admin');

create table if not exists public.platform_users (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role text not null,
  status text not null default 'active',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,

  constraint platform_users_role_check
    check (role in ('owner', 'admin', 'support', 'operator', 'readonly')),
  constraint platform_users_status_check
    check (status in ('active', 'inactive')),
  constraint platform_users_profile_unique unique (profile_id)
);

create index if not exists platform_users_profile_status_idx
  on public.platform_users (profile_id, status);
create index if not exists platform_users_role_status_idx
  on public.platform_users (role, status);

drop trigger if exists set_platform_users_updated_at on public.platform_users;
create trigger set_platform_users_updated_at
before update on public.platform_users
for each row execute function public.set_updated_at();

alter table public.platform_users enable row level security;

grant select, insert, update, delete on public.platform_users to authenticated;

create or replace function public.current_user_is_platform_user(
  p_allowed_roles text[] default null
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.platform_users as pu
    where pu.profile_id = auth.uid()
      and pu.status = 'active'
      and (
        p_allowed_roles is null
        or pu.role = any(p_allowed_roles)
      )
  );
$$;

revoke all on function public.current_user_is_platform_user(text[]) from public;
grant execute on function public.current_user_is_platform_user(text[]) to authenticated;

drop policy if exists platform_users_select_platform_active on public.platform_users;
create policy platform_users_select_platform_active
on public.platform_users
for select
to authenticated
using (public.current_user_is_platform_user(null));

drop policy if exists platform_users_insert_platform_owner_admin on public.platform_users;
create policy platform_users_insert_platform_owner_admin
on public.platform_users
for insert
to authenticated
with check (public.current_user_is_platform_user(array['owner', 'admin']));

drop policy if exists platform_users_update_platform_owner_admin on public.platform_users;
create policy platform_users_update_platform_owner_admin
on public.platform_users
for update
to authenticated
using (public.current_user_is_platform_user(array['owner', 'admin']))
with check (public.current_user_is_platform_user(array['owner', 'admin']));

drop policy if exists platform_users_delete_platform_owner_admin on public.platform_users;
create policy platform_users_delete_platform_owner_admin
on public.platform_users
for delete
to authenticated
using (public.current_user_is_platform_user(array['owner', 'admin']));

drop policy if exists empresas_select_platform_console on public.empresas;
create policy empresas_select_platform_console
on public.empresas
for select
to authenticated
using (public.current_user_is_platform_user(null));

drop policy if exists profiles_select_platform_console on public.profiles;
create policy profiles_select_platform_console
on public.profiles
for select
to authenticated
using (public.current_user_is_platform_user(null));

drop policy if exists modulos_select_platform_console on public.modulos;
create policy modulos_select_platform_console
on public.modulos
for select
to authenticated
using (public.current_user_is_platform_user(null));

drop policy if exists empresa_modulos_select_platform_console on public.empresa_modulos;
create policy empresa_modulos_select_platform_console
on public.empresa_modulos
for select
to authenticated
using (public.current_user_is_platform_user(null));

drop policy if exists planes_select_platform_console on public.planes;
create policy planes_select_platform_console
on public.planes
for select
to authenticated
using (public.current_user_is_platform_user(null));

drop policy if exists empresa_plan_select_platform_console on public.empresa_plan;
create policy empresa_plan_select_platform_console
on public.empresa_plan
for select
to authenticated
using (public.current_user_is_platform_user(null));

drop policy if exists empresa_modulo_health_select_platform_console on public.empresa_modulo_health;
create policy empresa_modulo_health_select_platform_console
on public.empresa_modulo_health
for select
to authenticated
using (public.current_user_is_platform_user(null));

drop policy if exists inbox_canales_select_platform_console on public.inbox_canales;
create policy inbox_canales_select_platform_console
on public.inbox_canales
for select
to authenticated
using (public.current_user_is_platform_user(null));

drop policy if exists inbox_webhook_eventos_select_platform_console on public.inbox_webhook_eventos;
create policy inbox_webhook_eventos_select_platform_console
on public.inbox_webhook_eventos
for select
to authenticated
using (public.current_user_is_platform_user(null));

