-- Whapp Meta templates: local catalog and guarded template send foundation.

create table if not exists public.inbox_meta_plantillas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  canal_id uuid references public.inbox_canales(id) on delete set null,
  nombre text not null,
  idioma text not null default 'es',
  categoria text not null default 'UTILITY',
  estado text not null default 'borrador',
  cuerpo text not null,
  variables jsonb not null default '[]'::jsonb,
  meta_template_id text,
  rechazo_motivo text,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inbox_meta_plantillas_canal_empresa_fkey
    foreign key (canal_id, empresa_id)
    references public.inbox_canales(id, empresa_id),
  constraint inbox_meta_plantillas_created_by_empresa_fkey
    foreign key (created_by, empresa_id)
    references public.profiles(id, empresa_id),
  constraint inbox_meta_plantillas_updated_by_empresa_fkey
    foreign key (updated_by, empresa_id)
    references public.profiles(id, empresa_id),
  constraint inbox_meta_plantillas_categoria_check
    check (categoria in ('AUTHENTICATION', 'MARKETING', 'UTILITY')),
  constraint inbox_meta_plantillas_estado_check
    check (estado in ('borrador', 'pendiente', 'aprobada', 'rechazada', 'pausada')),
  constraint inbox_meta_plantillas_nombre_format_check
    check (nombre ~ '^[a-z0-9_]+$'),
  constraint inbox_meta_plantillas_empresa_nombre_idioma_unique
    unique (empresa_id, nombre, idioma)
);

create index if not exists inbox_meta_plantillas_empresa_id_idx
  on public.inbox_meta_plantillas (empresa_id);

create index if not exists inbox_meta_plantillas_empresa_estado_idx
  on public.inbox_meta_plantillas (empresa_id, estado);

create index if not exists inbox_meta_plantillas_empresa_canal_idx
  on public.inbox_meta_plantillas (empresa_id, canal_id);

drop trigger if exists set_inbox_meta_plantillas_updated_at
on public.inbox_meta_plantillas;

create trigger set_inbox_meta_plantillas_updated_at
before update on public.inbox_meta_plantillas
for each row execute function public.set_updated_at();

alter table public.inbox_meta_plantillas enable row level security;

grant select, insert, update on public.inbox_meta_plantillas to authenticated;

drop policy if exists inbox_meta_plantillas_select_permission
on public.inbox_meta_plantillas;

create policy inbox_meta_plantillas_select_permission
on public.inbox_meta_plantillas
for select
to authenticated
using (
  empresa_id = public.current_empresa_id()
  and (
    public.current_user_has_permission('inbox.channels.view')
    or public.current_user_has_permission('inbox.channels.manage')
    or public.current_user_has_permission('inbox.conversations.reply')
  )
);

drop policy if exists inbox_meta_plantillas_insert_permission
on public.inbox_meta_plantillas;

create policy inbox_meta_plantillas_insert_permission
on public.inbox_meta_plantillas
for insert
to authenticated
with check (
  empresa_id = public.current_empresa_id()
  and public.current_user_has_permission('inbox.channels.manage')
);

drop policy if exists inbox_meta_plantillas_update_permission
on public.inbox_meta_plantillas;

create policy inbox_meta_plantillas_update_permission
on public.inbox_meta_plantillas
for update
to authenticated
using (
  empresa_id = public.current_empresa_id()
  and public.current_user_has_permission('inbox.channels.manage')
)
with check (
  empresa_id = public.current_empresa_id()
  and public.current_user_has_permission('inbox.channels.manage')
);
