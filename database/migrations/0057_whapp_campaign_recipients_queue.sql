-- Whapp campaigns: recipient queue, opt-in and delivery audit foundation.

alter table public.inbox_campanas
  add constraint inbox_campanas_id_empresa_unique
  unique (id, empresa_id);

create table if not exists public.inbox_campana_destinatarios (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  campana_id uuid not null references public.inbox_campanas(id) on delete cascade,
  cliente_id uuid,
  conversacion_id uuid,
  nombre text,
  telefono text not null,
  external_recipient_id text,
  opt_in boolean not null default false,
  opt_in_source text,
  opt_in_at timestamptz,
  estado text not null default 'pendiente',
  variables jsonb not null default '{}'::jsonb,
  last_error text,
  sent_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  replied_at timestamptz,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inbox_campana_destinatarios_campana_empresa_fkey
    foreign key (campana_id, empresa_id)
    references public.inbox_campanas(id, empresa_id)
    on delete cascade,
  constraint inbox_campana_destinatarios_cliente_empresa_fkey
    foreign key (cliente_id, empresa_id)
    references public.crm_clientes(id, empresa_id)
    on delete set null (cliente_id),
  constraint inbox_campana_destinatarios_conversacion_empresa_fkey
    foreign key (conversacion_id, empresa_id)
    references public.inbox_conversaciones(id, empresa_id)
    on delete set null (conversacion_id),
  constraint inbox_campana_destinatarios_created_by_empresa_fkey
    foreign key (created_by, empresa_id)
    references public.profiles(id, empresa_id),
  constraint inbox_campana_destinatarios_updated_by_empresa_fkey
    foreign key (updated_by, empresa_id)
    references public.profiles(id, empresa_id),
  constraint inbox_campana_destinatarios_estado_check
    check (
      estado in (
        'pendiente',
        'listo',
        'en_cola',
        'enviado',
        'entregado',
        'leido',
        'respondido',
        'fallido',
        'excluido'
      )
    ),
  constraint inbox_campana_destinatarios_opt_in_check
    check (
      estado in ('pendiente', 'excluido')
      or opt_in = true
    ),
  constraint inbox_campana_destinatarios_unique
    unique (empresa_id, campana_id, telefono)
);

create index if not exists inbox_campana_destinatarios_empresa_id_idx
  on public.inbox_campana_destinatarios (empresa_id);

create index if not exists inbox_campana_destinatarios_campana_idx
  on public.inbox_campana_destinatarios (empresa_id, campana_id);

create index if not exists inbox_campana_destinatarios_estado_idx
  on public.inbox_campana_destinatarios (empresa_id, estado);

create index if not exists inbox_campana_destinatarios_cliente_idx
  on public.inbox_campana_destinatarios (empresa_id, cliente_id)
  where cliente_id is not null;

drop trigger if exists set_inbox_campana_destinatarios_updated_at
on public.inbox_campana_destinatarios;

create trigger set_inbox_campana_destinatarios_updated_at
before update on public.inbox_campana_destinatarios
for each row execute function public.set_updated_at();

alter table public.inbox_campana_destinatarios enable row level security;

grant select, insert, update on public.inbox_campana_destinatarios to authenticated;

drop policy if exists inbox_campana_destinatarios_select_permission
on public.inbox_campana_destinatarios;

create policy inbox_campana_destinatarios_select_permission
on public.inbox_campana_destinatarios
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

drop policy if exists inbox_campana_destinatarios_insert_permission
on public.inbox_campana_destinatarios;

create policy inbox_campana_destinatarios_insert_permission
on public.inbox_campana_destinatarios
for insert
to authenticated
with check (
  empresa_id = public.current_empresa_id()
  and public.current_user_has_permission('inbox.channels.manage')
  and exists (
    select 1
    from public.inbox_campanas c
    where c.id = public.inbox_campana_destinatarios.campana_id
      and c.empresa_id = public.inbox_campana_destinatarios.empresa_id
      and c.estado in ('borrador', 'programada', 'pausada')
  )
);

drop policy if exists inbox_campana_destinatarios_update_permission
on public.inbox_campana_destinatarios;

create policy inbox_campana_destinatarios_update_permission
on public.inbox_campana_destinatarios
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
