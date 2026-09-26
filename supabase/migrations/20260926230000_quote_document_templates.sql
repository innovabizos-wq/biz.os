-- Commercial quote presentation settings. This does not alter historical quote
-- data; it only controls the branded document generated for each company.

create table if not exists public.company_quote_document_settings (
  empresa_id uuid primary key references public.empresas(id) on delete cascade,
  template_code text not null default 'executive',
  document_label text not null default 'Proforma',
  accent_color text not null default '#0F766E',
  logo_data_url text,
  footer_text text,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint company_quote_document_settings_template_check
    check (template_code in ('executive', 'bold', 'minimal', 'editorial', 'classic')),
  constraint company_quote_document_settings_label_check
    check (document_label in ('Cotización', 'Proforma', 'Presupuesto')),
  constraint company_quote_document_settings_accent_check
    check (accent_color in ('#0F766E', '#1D4ED8', '#BE123C', '#7E22CE', '#334155')),
  constraint company_quote_document_settings_logo_size_check
    check (logo_data_url is null or octet_length(logo_data_url) <= 700000),
  constraint company_quote_document_settings_footer_size_check
    check (footer_text is null or char_length(footer_text) <= 300),
  constraint company_quote_document_settings_updated_by_empresa_fkey
    foreign key (updated_by, empresa_id)
    references public.profiles(id, empresa_id)
    on delete set null (updated_by)
);

drop trigger if exists set_company_quote_document_settings_updated_at on public.company_quote_document_settings;
create trigger set_company_quote_document_settings_updated_at
before update on public.company_quote_document_settings
for each row execute function public.set_updated_at();

alter table public.company_quote_document_settings enable row level security;

grant select on public.company_quote_document_settings to authenticated;
grant insert, update on public.company_quote_document_settings to authenticated;

drop policy if exists company_quote_document_settings_read_company on public.company_quote_document_settings;
create policy company_quote_document_settings_read_company
on public.company_quote_document_settings for select to authenticated
using (
  empresa_id = (select public.current_empresa_id())
  and (
    (select public.current_user_has_permission('quotes.view'))
    or (select public.current_user_has_permission('admin.settings.view'))
    or (select public.current_user_has_permission('admin.settings.manage'))
  )
);

drop policy if exists company_quote_document_settings_write_admin on public.company_quote_document_settings;
create policy company_quote_document_settings_write_admin
on public.company_quote_document_settings for all to authenticated
using (
  empresa_id = (select public.current_empresa_id())
  and (select public.current_user_has_permission('admin.settings.manage'))
)
with check (
  empresa_id = (select public.current_empresa_id())
  and (select public.current_user_has_permission('admin.settings.manage'))
);
