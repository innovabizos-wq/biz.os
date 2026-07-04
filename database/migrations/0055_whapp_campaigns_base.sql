-- Whapp campaigns: controlled campaign catalog and metrics foundation.

alter table public.inbox_meta_plantillas
  add constraint inbox_meta_plantillas_id_empresa_unique
  unique (id, empresa_id);

create table if not exists public.inbox_campanas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  canal_id uuid not null references public.inbox_canales(id),
  plantilla_id uuid not null references public.inbox_meta_plantillas(id),
  nombre text not null,
  objetivo text,
  estado text not null default 'borrador',
  audiencia jsonb not null default '{}'::jsonb,
  scheduled_at timestamptz,
  recipient_count integer not null default 0,
  sent_count integer not null default 0,
  delivered_count integer not null default 0,
  read_count integer not null default 0,
  replied_count integer not null default 0,
  failed_count integer not null default 0,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inbox_campanas_canal_empresa_fkey
    foreign key (canal_id, empresa_id)
    references public.inbox_canales(id, empresa_id),
  constraint inbox_campanas_plantilla_empresa_fkey
    foreign key (plantilla_id, empresa_id)
    references public.inbox_meta_plantillas(id, empresa_id),
  constraint inbox_campanas_created_by_empresa_fkey
    foreign key (created_by, empresa_id)
    references public.profiles(id, empresa_id),
  constraint inbox_campanas_updated_by_empresa_fkey
    foreign key (updated_by, empresa_id)
    references public.profiles(id, empresa_id),
  constraint inbox_campanas_estado_check
    check (
      estado in (
        'borrador',
        'programada',
        'enviando',
        'enviada',
        'pausada',
        'cancelada'
      )
    ),
  constraint inbox_campanas_counts_check
    check (
      recipient_count >= 0
      and sent_count >= 0
      and delivered_count >= 0
      and read_count >= 0
      and replied_count >= 0
      and failed_count >= 0
    )
);

create index if not exists inbox_campanas_empresa_id_idx
  on public.inbox_campanas (empresa_id);

create index if not exists inbox_campanas_empresa_estado_idx
  on public.inbox_campanas (empresa_id, estado);

create index if not exists inbox_campanas_empresa_canal_idx
  on public.inbox_campanas (empresa_id, canal_id);

create index if not exists inbox_campanas_empresa_plantilla_idx
  on public.inbox_campanas (empresa_id, plantilla_id);

create index if not exists inbox_campanas_scheduled_at_idx
  on public.inbox_campanas (scheduled_at)
  where scheduled_at is not null;

drop trigger if exists set_inbox_campanas_updated_at
on public.inbox_campanas;

create trigger set_inbox_campanas_updated_at
before update on public.inbox_campanas
for each row execute function public.set_updated_at();

alter table public.inbox_campanas enable row level security;

grant select, insert, update on public.inbox_campanas to authenticated;

drop policy if exists inbox_campanas_select_permission
on public.inbox_campanas;

create policy inbox_campanas_select_permission
on public.inbox_campanas
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

drop policy if exists inbox_campanas_insert_permission
on public.inbox_campanas;

create policy inbox_campanas_insert_permission
on public.inbox_campanas
for insert
to authenticated
with check (
  empresa_id = public.current_empresa_id()
  and public.current_user_has_permission('inbox.channels.manage')
  and exists (
    select 1
    from public.inbox_canales c
    where c.id = public.inbox_campanas.canal_id
      and c.empresa_id = public.inbox_campanas.empresa_id
      and c.canal = 'whatsapp'
      and c.proveedor = 'meta'
      and c.estado = 'activo'
      and c.conexion_estado = 'configurado'
  )
  and exists (
    select 1
    from public.inbox_meta_plantillas p
    where p.id = public.inbox_campanas.plantilla_id
      and p.empresa_id = public.inbox_campanas.empresa_id
      and p.estado = 'aprobada'
      and (
        p.canal_id is null
        or p.canal_id = public.inbox_campanas.canal_id
      )
  )
);

drop policy if exists inbox_campanas_update_permission
on public.inbox_campanas;

create policy inbox_campanas_update_permission
on public.inbox_campanas
for update
to authenticated
using (
  empresa_id = public.current_empresa_id()
  and public.current_user_has_permission('inbox.channels.manage')
)
with check (
  empresa_id = public.current_empresa_id()
  and public.current_user_has_permission('inbox.channels.manage')
  and exists (
    select 1
    from public.inbox_canales c
    where c.id = public.inbox_campanas.canal_id
      and c.empresa_id = public.inbox_campanas.empresa_id
      and c.canal = 'whatsapp'
      and c.proveedor = 'meta'
      and c.estado = 'activo'
      and c.conexion_estado = 'configurado'
  )
  and exists (
    select 1
    from public.inbox_meta_plantillas p
    where p.id = public.inbox_campanas.plantilla_id
      and p.empresa_id = public.inbox_campanas.empresa_id
      and p.estado = 'aprobada'
      and (
        p.canal_id is null
        or p.canal_id = public.inbox_campanas.canal_id
      )
  )
);
