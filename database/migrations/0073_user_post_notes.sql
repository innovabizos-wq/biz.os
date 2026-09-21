create table public.user_post_notes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  profile_id uuid not null,
  scope_key text not null,
  content text not null default '',
  color text not null default 'yellow',
  position_x double precision not null default 0.72,
  position_y double precision not null default 0.14,
  width integer not null default 300,
  height integer not null default 260,
  last_focused_at timestamptz not null default now(),
  remind_at timestamptz,
  reminder_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint user_post_notes_profile_empresa_fkey
    foreign key (profile_id, empresa_id)
    references public.profiles(id, empresa_id)
    on delete cascade,
  constraint user_post_notes_scope_key_check
    check (scope_key ~ '^[a-z0-9-]{1,80}$'),
  constraint user_post_notes_content_length_check
    check (char_length(content) <= 4000),
  constraint user_post_notes_color_check
    check (color in ('yellow', 'pink', 'blue', 'green', 'purple')),
  constraint user_post_notes_position_x_check
    check (position_x between 0 and 1),
  constraint user_post_notes_position_y_check
    check (position_y between 0 and 1),
  constraint user_post_notes_width_check
    check (width between 220 and 560),
  constraint user_post_notes_height_check
    check (height between 180 and 560),
  constraint user_post_notes_reminder_state_check
    check (reminder_sent_at is null or remind_at is not null)
);

create index user_post_notes_owner_scope_focus_idx
  on public.user_post_notes (empresa_id, profile_id, scope_key, last_focused_at);

create index user_post_notes_pending_reminder_idx
  on public.user_post_notes (remind_at)
  where remind_at is not null and reminder_sent_at is null;

create trigger set_user_post_notes_updated_at
before update on public.user_post_notes
for each row execute function public.set_updated_at();

alter table public.user_post_notes enable row level security;

grant select, insert, delete on public.user_post_notes to authenticated;
grant update (
  content,
  color,
  position_x,
  position_y,
  width,
  height,
  last_focused_at,
  remind_at,
  reminder_sent_at,
  updated_at
) on public.user_post_notes to authenticated;

create policy user_post_notes_select_own
on public.user_post_notes
for select
to authenticated
using (
  empresa_id = public.current_empresa_id()
  and profile_id = auth.uid()
);

create policy user_post_notes_insert_own
on public.user_post_notes
for insert
to authenticated
with check (
  empresa_id = public.current_empresa_id()
  and profile_id = auth.uid()
);

create policy user_post_notes_update_own
on public.user_post_notes
for update
to authenticated
using (
  empresa_id = public.current_empresa_id()
  and profile_id = auth.uid()
)
with check (
  empresa_id = public.current_empresa_id()
  and profile_id = auth.uid()
);

create policy user_post_notes_delete_own
on public.user_post_notes
for delete
to authenticated
using (
  empresa_id = public.current_empresa_id()
  and profile_id = auth.uid()
);

comment on table public.user_post_notes is
  'Notas Post privadas por usuario y modulo. Los campos de recordatorio se activaran en una etapa posterior.';
