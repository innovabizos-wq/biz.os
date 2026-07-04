-- Whapp automations: configurable autopilot rules and execution audit base.

create table if not exists public.inbox_automatizaciones (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  canal_id uuid references public.inbox_canales(id) on delete set null,
  nombre text not null,
  descripcion text,
  trigger_tipo text not null,
  accion_tipo text not null,
  modo text not null default 'sugerida',
  estado text not null default 'inactiva',
  condiciones jsonb not null default '{}'::jsonb,
  accion_config jsonb not null default '{}'::jsonb,
  prioridad integer not null default 100,
  ultima_ejecucion_at timestamptz,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inbox_automatizaciones_canal_empresa_fkey
    foreign key (canal_id, empresa_id)
    references public.inbox_canales(id, empresa_id),
  constraint inbox_automatizaciones_created_by_empresa_fkey
    foreign key (created_by, empresa_id)
    references public.profiles(id, empresa_id),
  constraint inbox_automatizaciones_updated_by_empresa_fkey
    foreign key (updated_by, empresa_id)
    references public.profiles(id, empresa_id),
  constraint inbox_automatizaciones_trigger_check
    check (
      trigger_tipo in (
        'conversacion_creada',
        'mensaje_entrante',
        'palabra_clave',
        'sla_en_riesgo',
        'sla_vencido'
      )
    ),
  constraint inbox_automatizaciones_accion_check
    check (
      accion_tipo in (
        'crear_sugerencia',
        'agregar_nota',
        'asignar_usuario',
        'cambiar_estado',
        'enviar_plantilla'
      )
    ),
  constraint inbox_automatizaciones_modo_check
    check (modo in ('sugerida', 'asistida', 'automatica')),
  constraint inbox_automatizaciones_estado_check
    check (estado in ('activa', 'inactiva', 'pausada')),
  constraint inbox_automatizaciones_prioridad_check
    check (prioridad >= 1 and prioridad <= 999),
  constraint inbox_automatizaciones_id_empresa_unique
    unique (id, empresa_id)
);

create table if not exists public.inbox_automatizacion_ejecuciones (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  automatizacion_id uuid not null references public.inbox_automatizaciones(id) on delete cascade,
  conversacion_id uuid references public.inbox_conversaciones(id) on delete set null,
  estado text not null default 'sugerida',
  resultado jsonb not null default '{}'::jsonb,
  error text,
  executed_at timestamptz not null default now(),
  created_by uuid,
  constraint inbox_automatizacion_ejecuciones_automation_empresa_fkey
    foreign key (automatizacion_id, empresa_id)
    references public.inbox_automatizaciones(id, empresa_id),
  constraint inbox_automatizacion_ejecuciones_conversation_empresa_fkey
    foreign key (conversacion_id, empresa_id)
    references public.inbox_conversaciones(id, empresa_id),
  constraint inbox_automatizacion_ejecuciones_created_by_empresa_fkey
    foreign key (created_by, empresa_id)
    references public.profiles(id, empresa_id),
  constraint inbox_automatizacion_ejecuciones_estado_check
    check (estado in ('sugerida', 'ejecutada', 'fallida', 'omitida'))
);

create index if not exists inbox_automatizaciones_empresa_id_idx
  on public.inbox_automatizaciones (empresa_id);

create index if not exists inbox_automatizaciones_empresa_estado_idx
  on public.inbox_automatizaciones (empresa_id, estado);

create index if not exists inbox_automatizaciones_empresa_trigger_idx
  on public.inbox_automatizaciones (empresa_id, trigger_tipo);

create index if not exists inbox_automatizaciones_empresa_canal_idx
  on public.inbox_automatizaciones (empresa_id, canal_id);

create index if not exists inbox_automatizacion_ejecuciones_empresa_id_idx
  on public.inbox_automatizacion_ejecuciones (empresa_id);

create index if not exists inbox_automatizacion_ejecuciones_automation_idx
  on public.inbox_automatizacion_ejecuciones (empresa_id, automatizacion_id);

create index if not exists inbox_automatizacion_ejecuciones_conversation_idx
  on public.inbox_automatizacion_ejecuciones (empresa_id, conversacion_id);

drop trigger if exists set_inbox_automatizaciones_updated_at
on public.inbox_automatizaciones;

create trigger set_inbox_automatizaciones_updated_at
before update on public.inbox_automatizaciones
for each row execute function public.set_updated_at();

alter table public.inbox_automatizaciones enable row level security;
alter table public.inbox_automatizacion_ejecuciones enable row level security;

grant select, insert, update on public.inbox_automatizaciones to authenticated;
grant select, insert on public.inbox_automatizacion_ejecuciones to authenticated;

drop policy if exists inbox_automatizaciones_select_permission
on public.inbox_automatizaciones;

create policy inbox_automatizaciones_select_permission
on public.inbox_automatizaciones
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

drop policy if exists inbox_automatizaciones_insert_permission
on public.inbox_automatizaciones;

create policy inbox_automatizaciones_insert_permission
on public.inbox_automatizaciones
for insert
to authenticated
with check (
  empresa_id = public.current_empresa_id()
  and (
    public.current_user_has_permission('inbox.channels.manage')
    or public.current_user_has_permission('inbox.conversations.reply')
  )
);

drop policy if exists inbox_automatizaciones_update_permission
on public.inbox_automatizaciones;

create policy inbox_automatizaciones_update_permission
on public.inbox_automatizaciones
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

drop policy if exists inbox_automatizacion_ejecuciones_select_permission
on public.inbox_automatizacion_ejecuciones;

create policy inbox_automatizacion_ejecuciones_select_permission
on public.inbox_automatizacion_ejecuciones
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

drop policy if exists inbox_automatizacion_ejecuciones_insert_permission
on public.inbox_automatizacion_ejecuciones;

create policy inbox_automatizacion_ejecuciones_insert_permission
on public.inbox_automatizacion_ejecuciones
for insert
to authenticated
with check (
  empresa_id = public.current_empresa_id()
  and public.current_user_has_permission('inbox.channels.manage')
);
