-- Autoblog MVP. Apply manually in Supabase SQL Editor.
-- This migration does not activate autoblog for all tenants.

insert into public.modulos (codigo, nombre, descripcion, estado, orden)
values (
  'autoblog',
  'Autoblog',
  'Articulos y contenido asistido por contexto de negocio.',
  'activo',
  85
)
on conflict (codigo) do update
set nombre = excluded.nombre,
    descripcion = excluded.descripcion,
    estado = excluded.estado,
    orden = excluded.orden;

insert into public.permisos (codigo, nombre, descripcion, modulo_codigo, estado)
values
  ('autoblog.view', 'Ver Autoblog', 'Permite consultar articulos y temas de Autoblog.', 'autoblog', 'activo'),
  ('autoblog.create', 'Crear articulos de Autoblog', 'Permite crear temas y borradores de Autoblog.', 'autoblog', 'activo'),
  ('autoblog.edit', 'Editar articulos de Autoblog', 'Permite editar articulos y enviarlos a revision.', 'autoblog', 'activo'),
  ('autoblog.publish', 'Aprobar/publicar articulos', 'Permite aprobar articulos y dejarlos listos para publicacion manual.', 'autoblog', 'activo'),
  ('autoblog.manage', 'Administrar Autoblog', 'Permite administrar articulos, estados y configuracion operativa de Autoblog.', 'autoblog', 'activo')
on conflict (codigo) do update
set nombre = excluded.nombre,
    descripcion = excluded.descripcion,
    modulo_codigo = excluded.modulo_codigo,
    estado = excluded.estado;

insert into public.rol_permisos (empresa_id, rol_id, permiso_id)
select r.empresa_id, r.id, p.id
from public.roles as r
join public.permisos as p
  on p.codigo in (
    'autoblog.view',
    'autoblog.create',
    'autoblog.edit',
    'autoblog.publish',
    'autoblog.manage'
  )
where r.es_sistema = true
  and r.nombre in ('Administrador', 'Super Admin')
on conflict on constraint rol_permisos_empresa_rol_permiso_unique
do nothing;

create table if not exists public.autoblog_articles (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  title text not null,
  slug text,
  summary text,
  content text not null default '',
  status text not null default 'draft',
  topic text,
  source_mode text not null default 'manual',
  source_urls jsonb not null default '[]'::jsonb,
  source_notes text,
  seo_title text,
  seo_description text,
  keywords text,
  social_facebook text,
  social_instagram text,
  social_linkedin text,
  social_whatsapp text,
  cta text,
  scheduled_for timestamptz,
  ready_to_publish_at timestamptz,
  approved_at timestamptz,
  approved_by uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint autoblog_articles_status_check
    check (status in ('draft', 'pending_review', 'approved', 'ready_to_publish', 'archived')),
  constraint autoblog_articles_source_mode_check
    check (source_mode in ('manual', 'news', 'trend', 'internal_context')),
  constraint autoblog_articles_source_urls_array_check
    check (jsonb_typeof(source_urls) = 'array')
);

create index if not exists autoblog_articles_empresa_status_idx
  on public.autoblog_articles (empresa_id, status);
create index if not exists autoblog_articles_empresa_created_idx
  on public.autoblog_articles (empresa_id, created_at desc);
create index if not exists autoblog_articles_empresa_ready_idx
  on public.autoblog_articles (empresa_id, ready_to_publish_at desc);
create index if not exists autoblog_articles_empresa_slug_idx
  on public.autoblog_articles (empresa_id, slug);

drop trigger if exists set_autoblog_articles_updated_at on public.autoblog_articles;
create trigger set_autoblog_articles_updated_at
before update on public.autoblog_articles
for each row execute function public.set_updated_at();

create table if not exists public.autoblog_topics (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  title text not null,
  description text,
  source_mode text not null default 'manual',
  source_urls jsonb not null default '[]'::jsonb,
  relevance_score numeric,
  status text not null default 'new',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),

  constraint autoblog_topics_source_mode_check
    check (source_mode in ('manual', 'news', 'trend', 'internal_context')),
  constraint autoblog_topics_status_check
    check (status in ('new', 'selected', 'used', 'discarded')),
  constraint autoblog_topics_source_urls_array_check
    check (jsonb_typeof(source_urls) = 'array')
);

create index if not exists autoblog_topics_empresa_status_idx
  on public.autoblog_topics (empresa_id, status);
create index if not exists autoblog_topics_empresa_created_idx
  on public.autoblog_topics (empresa_id, created_at desc);

alter table public.autoblog_articles enable row level security;
alter table public.autoblog_topics enable row level security;

grant select, insert, update on public.autoblog_articles to authenticated;
grant select, insert, update on public.autoblog_topics to authenticated;

drop policy if exists autoblog_articles_select_permission on public.autoblog_articles;
create policy autoblog_articles_select_permission
on public.autoblog_articles
for select
to authenticated
using (
  empresa_id = public.current_empresa_id()
  and (
    public.current_user_has_permission('autoblog.view')
    or public.current_user_has_permission('autoblog.manage')
  )
);

drop policy if exists autoblog_articles_insert_permission on public.autoblog_articles;
create policy autoblog_articles_insert_permission
on public.autoblog_articles
for insert
to authenticated
with check (
  empresa_id = public.current_empresa_id()
  and (
    public.current_user_has_permission('autoblog.create')
    or public.current_user_has_permission('autoblog.manage')
  )
);

drop policy if exists autoblog_articles_update_permission on public.autoblog_articles;
create policy autoblog_articles_update_permission
on public.autoblog_articles
for update
to authenticated
using (
  empresa_id = public.current_empresa_id()
  and (
    public.current_user_has_permission('autoblog.edit')
    or public.current_user_has_permission('autoblog.publish')
    or public.current_user_has_permission('autoblog.manage')
  )
)
with check (
  empresa_id = public.current_empresa_id()
  and (
    public.current_user_has_permission('autoblog.edit')
    or public.current_user_has_permission('autoblog.publish')
    or public.current_user_has_permission('autoblog.manage')
  )
);

drop policy if exists autoblog_topics_select_permission on public.autoblog_topics;
create policy autoblog_topics_select_permission
on public.autoblog_topics
for select
to authenticated
using (
  empresa_id = public.current_empresa_id()
  and (
    public.current_user_has_permission('autoblog.view')
    or public.current_user_has_permission('autoblog.manage')
  )
);

drop policy if exists autoblog_topics_insert_permission on public.autoblog_topics;
create policy autoblog_topics_insert_permission
on public.autoblog_topics
for insert
to authenticated
with check (
  empresa_id = public.current_empresa_id()
  and (
    public.current_user_has_permission('autoblog.create')
    or public.current_user_has_permission('autoblog.manage')
  )
);

drop policy if exists autoblog_topics_update_permission on public.autoblog_topics;
create policy autoblog_topics_update_permission
on public.autoblog_topics
for update
to authenticated
using (
  empresa_id = public.current_empresa_id()
  and public.current_user_has_permission('autoblog.manage')
)
with check (
  empresa_id = public.current_empresa_id()
  and public.current_user_has_permission('autoblog.manage')
);

create or replace function public.crear_autoblog_topic(
  p_title text,
  p_description text default null,
  p_source_mode text default 'manual',
  p_source_urls jsonb default '[]'::jsonb
)
returns table (
  id uuid,
  title text,
  description text,
  source_mode text,
  source_urls jsonb,
  relevance_score numeric,
  status text,
  created_by uuid,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_empresa_id uuid := public.current_empresa_id();
  v_topic public.autoblog_topics%rowtype;
  v_title text := nullif(btrim(coalesce(p_title, '')), '');
  v_source_mode text := coalesce(nullif(btrim(p_source_mode), ''), 'manual');
  v_source_urls jsonb := coalesce(p_source_urls, '[]'::jsonb);
begin
  if v_user_id is null or v_empresa_id is null then
    raise exception 'Usuario autenticado requerido.' using errcode = '28000';
  end if;

  if not (
    public.current_user_has_permission('autoblog.create')
    or public.current_user_has_permission('autoblog.manage')
  ) then
    raise exception 'Permiso para crear temas de Autoblog requerido.' using errcode = '42501';
  end if;

  if v_title is null then
    raise exception 'Titulo de tema requerido.' using errcode = '22023';
  end if;

  if v_source_mode not in ('manual', 'news', 'trend', 'internal_context') then
    raise exception 'Modo de fuente invalido.' using errcode = '22023';
  end if;

  if jsonb_typeof(v_source_urls) <> 'array' then
    raise exception 'Las fuentes deben ser un arreglo JSON.' using errcode = '22023';
  end if;

  insert into public.autoblog_topics (
    empresa_id,
    title,
    description,
    source_mode,
    source_urls,
    created_by
  )
  values (
    v_empresa_id,
    v_title,
    nullif(btrim(coalesce(p_description, '')), ''),
    v_source_mode,
    v_source_urls,
    v_user_id
  )
  returning * into v_topic;

  insert into public.auditoria_eventos (
    empresa_id,
    usuario_id,
    entidad,
    entidad_id,
    accion,
    datos_despues
  )
  values (
    v_empresa_id,
    v_user_id,
    'autoblog_topics',
    v_topic.id,
    'crear_autoblog_topic',
    to_jsonb(v_topic)
  );

  return query
  select
    v_topic.id,
    v_topic.title,
    v_topic.description,
    v_topic.source_mode,
    v_topic.source_urls,
    v_topic.relevance_score,
    v_topic.status,
    v_topic.created_by,
    v_topic.created_at;
end;
$$;

create or replace function public.obtener_autoblog_topics(
  p_status text default null,
  p_limit integer default 50
)
returns table (
  id uuid,
  title text,
  description text,
  source_mode text,
  source_urls jsonb,
  relevance_score numeric,
  status text,
  created_by uuid,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_empresa_id uuid := public.current_empresa_id();
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100);
  v_status text := nullif(btrim(coalesce(p_status, '')), '');
begin
  if v_user_id is null or v_empresa_id is null then
    raise exception 'Usuario autenticado requerido.' using errcode = '28000';
  end if;

  if not (
    public.current_user_has_permission('autoblog.view')
    or public.current_user_has_permission('autoblog.manage')
  ) then
    raise exception 'Permiso para ver Autoblog requerido.' using errcode = '42501';
  end if;

  if v_status is not null
    and v_status not in ('new', 'selected', 'used', 'discarded') then
    raise exception 'Estado de tema invalido.' using errcode = '22023';
  end if;

  return query
  select
    t.id,
    t.title,
    t.description,
    t.source_mode,
    t.source_urls,
    t.relevance_score,
    t.status,
    t.created_by,
    t.created_at
  from public.autoblog_topics as t
  where t.empresa_id = v_empresa_id
    and (v_status is null or t.status = v_status)
  order by t.created_at desc
  limit v_limit;
end;
$$;

create or replace function public.crear_autoblog_article(
  p_title text,
  p_summary text default null,
  p_content text default '',
  p_topic text default null,
  p_source_mode text default 'manual',
  p_source_urls jsonb default '[]'::jsonb,
  p_source_notes text default null,
  p_seo_title text default null,
  p_seo_description text default null,
  p_keywords text default null,
  p_social_facebook text default null,
  p_social_instagram text default null,
  p_social_linkedin text default null,
  p_social_whatsapp text default null,
  p_cta text default null
)
returns table (article_id uuid, status text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_empresa_id uuid := public.current_empresa_id();
  v_article public.autoblog_articles%rowtype;
  v_title text := nullif(btrim(coalesce(p_title, '')), '');
  v_source_mode text := coalesce(nullif(btrim(p_source_mode), ''), 'manual');
  v_source_urls jsonb := coalesce(p_source_urls, '[]'::jsonb);
begin
  if v_user_id is null or v_empresa_id is null then
    raise exception 'Usuario autenticado requerido.' using errcode = '28000';
  end if;

  if not (
    public.current_user_has_permission('autoblog.create')
    or public.current_user_has_permission('autoblog.manage')
  ) then
    raise exception 'Permiso para crear articulos de Autoblog requerido.' using errcode = '42501';
  end if;

  if v_title is null then
    raise exception 'Titulo de articulo requerido.' using errcode = '22023';
  end if;

  if v_source_mode not in ('manual', 'news', 'trend', 'internal_context') then
    raise exception 'Modo de fuente invalido.' using errcode = '22023';
  end if;

  if jsonb_typeof(v_source_urls) <> 'array' then
    raise exception 'Las fuentes deben ser un arreglo JSON.' using errcode = '22023';
  end if;

  insert into public.autoblog_articles (
    empresa_id,
    title,
    summary,
    content,
    topic,
    source_mode,
    source_urls,
    source_notes,
    seo_title,
    seo_description,
    keywords,
    social_facebook,
    social_instagram,
    social_linkedin,
    social_whatsapp,
    cta,
    created_by,
    updated_by
  )
  values (
    v_empresa_id,
    v_title,
    nullif(btrim(coalesce(p_summary, '')), ''),
    coalesce(p_content, ''),
    nullif(btrim(coalesce(p_topic, '')), ''),
    v_source_mode,
    v_source_urls,
    nullif(btrim(coalesce(p_source_notes, '')), ''),
    nullif(btrim(coalesce(p_seo_title, '')), ''),
    nullif(btrim(coalesce(p_seo_description, '')), ''),
    nullif(btrim(coalesce(p_keywords, '')), ''),
    nullif(btrim(coalesce(p_social_facebook, '')), ''),
    nullif(btrim(coalesce(p_social_instagram, '')), ''),
    nullif(btrim(coalesce(p_social_linkedin, '')), ''),
    nullif(btrim(coalesce(p_social_whatsapp, '')), ''),
    nullif(btrim(coalesce(p_cta, '')), ''),
    v_user_id,
    v_user_id
  )
  returning * into v_article;

  insert into public.auditoria_eventos (
    empresa_id,
    usuario_id,
    entidad,
    entidad_id,
    accion,
    datos_despues
  )
  values (
    v_empresa_id,
    v_user_id,
    'autoblog_articles',
    v_article.id,
    'crear_autoblog_article',
    to_jsonb(v_article)
  );

  perform public.crear_notificacion_propia(
    'info',
    'Borrador de artículo creado',
    null,
    '/autoblog/' || v_article.id::text,
    'autoblog_article',
    v_article.id,
    '{}'::jsonb
  );

  return query select v_article.id, v_article.status;
end;
$$;

create or replace function public.actualizar_autoblog_article(
  p_article_id uuid,
  p_title text,
  p_summary text default null,
  p_content text default '',
  p_topic text default null,
  p_source_mode text default 'manual',
  p_source_urls jsonb default '[]'::jsonb,
  p_source_notes text default null,
  p_seo_title text default null,
  p_seo_description text default null,
  p_keywords text default null,
  p_social_facebook text default null,
  p_social_instagram text default null,
  p_social_linkedin text default null,
  p_social_whatsapp text default null,
  p_cta text default null
)
returns table (article_id uuid, status text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_empresa_id uuid := public.current_empresa_id();
  v_antes public.autoblog_articles%rowtype;
  v_despues public.autoblog_articles%rowtype;
  v_title text := nullif(btrim(coalesce(p_title, '')), '');
  v_source_mode text := coalesce(nullif(btrim(p_source_mode), ''), 'manual');
  v_source_urls jsonb := coalesce(p_source_urls, '[]'::jsonb);
begin
  if v_user_id is null or v_empresa_id is null then
    raise exception 'Usuario autenticado requerido.' using errcode = '28000';
  end if;

  if not (
    public.current_user_has_permission('autoblog.edit')
    or public.current_user_has_permission('autoblog.manage')
  ) then
    raise exception 'Permiso para editar articulos de Autoblog requerido.' using errcode = '42501';
  end if;

  if v_title is null then
    raise exception 'Titulo de articulo requerido.' using errcode = '22023';
  end if;

  if v_source_mode not in ('manual', 'news', 'trend', 'internal_context') then
    raise exception 'Modo de fuente invalido.' using errcode = '22023';
  end if;

  if jsonb_typeof(v_source_urls) <> 'array' then
    raise exception 'Las fuentes deben ser un arreglo JSON.' using errcode = '22023';
  end if;

  select a.* into v_antes
  from public.autoblog_articles as a
  where a.id = p_article_id
    and a.empresa_id = v_empresa_id;

  if v_antes.id is null then
    raise exception 'Articulo no encontrado.' using errcode = '02000';
  end if;

  update public.autoblog_articles as a
  set
    title = v_title,
    summary = nullif(btrim(coalesce(p_summary, '')), ''),
    content = coalesce(p_content, ''),
    topic = nullif(btrim(coalesce(p_topic, '')), ''),
    source_mode = v_source_mode,
    source_urls = v_source_urls,
    source_notes = nullif(btrim(coalesce(p_source_notes, '')), ''),
    seo_title = nullif(btrim(coalesce(p_seo_title, '')), ''),
    seo_description = nullif(btrim(coalesce(p_seo_description, '')), ''),
    keywords = nullif(btrim(coalesce(p_keywords, '')), ''),
    social_facebook = nullif(btrim(coalesce(p_social_facebook, '')), ''),
    social_instagram = nullif(btrim(coalesce(p_social_instagram, '')), ''),
    social_linkedin = nullif(btrim(coalesce(p_social_linkedin, '')), ''),
    social_whatsapp = nullif(btrim(coalesce(p_social_whatsapp, '')), ''),
    cta = nullif(btrim(coalesce(p_cta, '')), ''),
    updated_by = v_user_id
  where a.id = p_article_id
    and a.empresa_id = v_empresa_id
  returning * into v_despues;

  insert into public.auditoria_eventos (
    empresa_id,
    usuario_id,
    entidad,
    entidad_id,
    accion,
    datos_antes,
    datos_despues
  )
  values (
    v_empresa_id,
    v_user_id,
    'autoblog_articles',
    v_despues.id,
    'actualizar_autoblog_article',
    to_jsonb(v_antes),
    to_jsonb(v_despues)
  );

  return query select v_despues.id, v_despues.status;
end;
$$;

create or replace function public.cambiar_estado_autoblog_article(
  p_article_id uuid,
  p_status text
)
returns table (article_id uuid, status text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_empresa_id uuid := public.current_empresa_id();
  v_antes public.autoblog_articles%rowtype;
  v_despues public.autoblog_articles%rowtype;
  v_status text := nullif(btrim(coalesce(p_status, '')), '');
begin
  if v_user_id is null or v_empresa_id is null then
    raise exception 'Usuario autenticado requerido.' using errcode = '28000';
  end if;

  if v_status not in ('draft', 'pending_review', 'approved', 'ready_to_publish', 'archived') then
    raise exception 'Estado de articulo invalido.' using errcode = '22023';
  end if;

  if v_status in ('approved', 'ready_to_publish') then
    if not (
      public.current_user_has_permission('autoblog.publish')
      or public.current_user_has_permission('autoblog.manage')
    ) then
      raise exception 'Permiso para aprobar articulos requerido.' using errcode = '42501';
    end if;
  elsif v_status = 'archived' then
    if not public.current_user_has_permission('autoblog.manage') then
      raise exception 'Permiso para administrar Autoblog requerido.' using errcode = '42501';
    end if;
  elsif not (
    public.current_user_has_permission('autoblog.edit')
    or public.current_user_has_permission('autoblog.manage')
  ) then
    raise exception 'Permiso para cambiar estado de Autoblog requerido.' using errcode = '42501';
  end if;

  select a.* into v_antes
  from public.autoblog_articles as a
  where a.id = p_article_id
    and a.empresa_id = v_empresa_id;

  if v_antes.id is null then
    raise exception 'Articulo no encontrado.' using errcode = '02000';
  end if;

  if v_status = 'ready_to_publish'
    and (
      nullif(btrim(coalesce(v_antes.title, '')), '') is null
      or nullif(btrim(coalesce(v_antes.content, '')), '') is null
    ) then
    raise exception 'El articulo necesita titulo y contenido para quedar listo.' using errcode = '22023';
  end if;

  update public.autoblog_articles as a
  set
    status = v_status,
    approved_at = case
      when v_status = 'approved' and a.approved_at is null then now()
      else a.approved_at
    end,
    approved_by = case
      when v_status = 'approved' then v_user_id
      else a.approved_by
    end,
    ready_to_publish_at = case
      when v_status = 'ready_to_publish' then now()
      else a.ready_to_publish_at
    end,
    updated_by = v_user_id
  where a.id = p_article_id
    and a.empresa_id = v_empresa_id
  returning * into v_despues;

  insert into public.auditoria_eventos (
    empresa_id,
    usuario_id,
    entidad,
    entidad_id,
    accion,
    datos_antes,
    datos_despues
  )
  values (
    v_empresa_id,
    v_user_id,
    'autoblog_articles',
    v_despues.id,
    'cambiar_estado_autoblog_article',
    to_jsonb(v_antes),
    to_jsonb(v_despues)
  );

  if v_status = 'approved' then
    perform public.crear_notificacion_propia(
      'success',
      'Artículo aprobado',
      null,
      '/autoblog/' || v_despues.id::text,
      'autoblog_article',
      v_despues.id,
      '{}'::jsonb
    );
  elsif v_status = 'ready_to_publish' then
    perform public.crear_notificacion_propia(
      'success',
      'Artículo listo para publicar',
      'El artículo quedó listo dentro de biz.os para copiar, compartir o publicar manualmente.',
      '/autoblog/' || v_despues.id::text,
      'autoblog_article',
      v_despues.id,
      '{}'::jsonb
    );
  end if;

  return query select v_despues.id, v_despues.status;
end;
$$;

create or replace function public.obtener_autoblog_articles(
  p_status text default null,
  p_limit integer default 50
)
returns table (
  id uuid,
  title text,
  slug text,
  summary text,
  content text,
  status text,
  topic text,
  source_mode text,
  source_urls jsonb,
  source_notes text,
  seo_title text,
  seo_description text,
  keywords text,
  social_facebook text,
  social_instagram text,
  social_linkedin text,
  social_whatsapp text,
  cta text,
  scheduled_for timestamptz,
  ready_to_publish_at timestamptz,
  approved_at timestamptz,
  approved_by uuid,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_empresa_id uuid := public.current_empresa_id();
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 100);
  v_status text := nullif(btrim(coalesce(p_status, '')), '');
begin
  if v_user_id is null or v_empresa_id is null then
    raise exception 'Usuario autenticado requerido.' using errcode = '28000';
  end if;

  if not (
    public.current_user_has_permission('autoblog.view')
    or public.current_user_has_permission('autoblog.manage')
  ) then
    raise exception 'Permiso para ver Autoblog requerido.' using errcode = '42501';
  end if;

  if v_status is not null
    and v_status not in ('draft', 'pending_review', 'approved', 'ready_to_publish', 'archived') then
    raise exception 'Estado de articulo invalido.' using errcode = '22023';
  end if;

  return query
  select
    a.id,
    a.title,
    a.slug,
    a.summary,
    a.content,
    a.status,
    a.topic,
    a.source_mode,
    a.source_urls,
    a.source_notes,
    a.seo_title,
    a.seo_description,
    a.keywords,
    a.social_facebook,
    a.social_instagram,
    a.social_linkedin,
    a.social_whatsapp,
    a.cta,
    a.scheduled_for,
    a.ready_to_publish_at,
    a.approved_at,
    a.approved_by,
    a.created_by,
    a.updated_by,
    a.created_at,
    a.updated_at
  from public.autoblog_articles as a
  where a.empresa_id = v_empresa_id
    and (v_status is null or a.status = v_status)
  order by a.created_at desc
  limit v_limit;
end;
$$;

create or replace function public.obtener_autoblog_article(
  p_article_id uuid
)
returns table (
  id uuid,
  title text,
  slug text,
  summary text,
  content text,
  status text,
  topic text,
  source_mode text,
  source_urls jsonb,
  source_notes text,
  seo_title text,
  seo_description text,
  keywords text,
  social_facebook text,
  social_instagram text,
  social_linkedin text,
  social_whatsapp text,
  cta text,
  scheduled_for timestamptz,
  ready_to_publish_at timestamptz,
  approved_at timestamptz,
  approved_by uuid,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_empresa_id uuid := public.current_empresa_id();
begin
  if v_user_id is null or v_empresa_id is null then
    raise exception 'Usuario autenticado requerido.' using errcode = '28000';
  end if;

  if not (
    public.current_user_has_permission('autoblog.view')
    or public.current_user_has_permission('autoblog.manage')
  ) then
    raise exception 'Permiso para ver Autoblog requerido.' using errcode = '42501';
  end if;

  return query
  select
    a.id,
    a.title,
    a.slug,
    a.summary,
    a.content,
    a.status,
    a.topic,
    a.source_mode,
    a.source_urls,
    a.source_notes,
    a.seo_title,
    a.seo_description,
    a.keywords,
    a.social_facebook,
    a.social_instagram,
    a.social_linkedin,
    a.social_whatsapp,
    a.cta,
    a.scheduled_for,
    a.ready_to_publish_at,
    a.approved_at,
    a.approved_by,
    a.created_by,
    a.updated_by,
    a.created_at,
    a.updated_at
  from public.autoblog_articles as a
  where a.id = p_article_id
    and a.empresa_id = v_empresa_id
  limit 1;
end;
$$;

revoke all on function public.crear_autoblog_topic(text, text, text, jsonb) from public;
revoke all on function public.obtener_autoblog_topics(text, integer) from public;
revoke all on function public.crear_autoblog_article(text, text, text, text, text, jsonb, text, text, text, text, text, text, text, text, text) from public;
revoke all on function public.actualizar_autoblog_article(uuid, text, text, text, text, text, jsonb, text, text, text, text, text, text, text, text, text) from public;
revoke all on function public.cambiar_estado_autoblog_article(uuid, text) from public;
revoke all on function public.obtener_autoblog_articles(text, integer) from public;
revoke all on function public.obtener_autoblog_article(uuid) from public;

grant execute on function public.crear_autoblog_topic(text, text, text, jsonb) to authenticated;
grant execute on function public.obtener_autoblog_topics(text, integer) to authenticated;
grant execute on function public.crear_autoblog_article(text, text, text, text, text, jsonb, text, text, text, text, text, text, text, text, text) to authenticated;
grant execute on function public.actualizar_autoblog_article(uuid, text, text, text, text, text, jsonb, text, text, text, text, text, text, text, text, text) to authenticated;
grant execute on function public.cambiar_estado_autoblog_article(uuid, text) to authenticated;
grant execute on function public.obtener_autoblog_articles(text, integer) to authenticated;
grant execute on function public.obtener_autoblog_article(uuid) to authenticated;
