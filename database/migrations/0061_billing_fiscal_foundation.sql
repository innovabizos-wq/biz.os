-- Billing fiscal foundation for Costa Rica electronic invoicing.
-- Additive migration: keeps legacy facturas_electronicas/configuraciones_empresa intact.

insert into public.permisos (codigo, nombre, descripcion, modulo_codigo, estado)
values
  ('billing.view', 'Ver facturacion', 'Permite ver el modulo de facturacion fiscal.', 'billing', 'activo'),
  ('billing.manage', 'Gestionar facturacion', 'Permite gestionar operaciones generales de facturacion fiscal.', 'billing', 'activo'),
  ('billing.issue', 'Emitir documentos fiscales', 'Permite preparar, validar, generar XML, firmar y enviar documentos fiscales.', 'billing', 'activo'),
  ('billing.cancel', 'Anular documentos fiscales', 'Permite anular documentos fiscales internos cuando corresponde.', 'billing', 'activo'),
  ('billing.credit_note', 'Crear notas de credito', 'Permite crear notas de credito fiscales.', 'billing', 'activo'),
  ('billing.debit_note', 'Crear notas de debito', 'Permite crear notas de debito fiscales.', 'billing', 'activo'),
  ('billing.receive', 'Recibir documentos fiscales', 'Permite cargar y gestionar documentos fiscales de proveedores.', 'billing', 'activo'),
  ('billing.config.view', 'Ver configuracion fiscal', 'Permite ver la configuracion fiscal sin secretos.', 'billing', 'activo'),
  ('billing.config.manage', 'Gestionar configuracion fiscal', 'Permite gestionar datos fiscales y referencias de secretos.', 'billing', 'activo'),
  ('billing.cabys.manage', 'Gestionar CABYS', 'Permite importar CABYS y asociarlo a productos o servicios.', 'billing', 'activo'),
  ('billing.reports.view', 'Ver reportes fiscales', 'Permite consultar reportes fiscales basicos.', 'billing', 'activo')
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
    'billing.view',
    'billing.manage',
    'billing.issue',
    'billing.cancel',
    'billing.credit_note',
    'billing.debit_note',
    'billing.receive',
    'billing.config.view',
    'billing.config.manage',
    'billing.cabys.manage',
    'billing.reports.view'
  )
where r.es_sistema = true
  and r.nombre in ('Administrador', 'Super Admin')
on conflict on constraint rol_permisos_empresa_rol_permiso_unique
do nothing;

create table if not exists public.company_fiscal_settings (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  legal_name text not null,
  trade_name text,
  identification_type text not null,
  identification_number text not null,
  identification_normalized text,
  email text not null,
  phone_country_code text,
  phone_number text,
  province_code text,
  canton_code text,
  district_code text,
  neighborhood text,
  address_line text,
  main_activity_code text,
  secondary_activity_codes jsonb not null default '[]'::jsonb,
  branch_code text not null default '001',
  terminal_code text not null default '00001',
  environment text not null default 'testing',
  default_currency text not null default 'CRC',
  default_sale_condition_code text,
  default_payment_method_code text,
  default_credit_term_days integer,
  hacienda_username_secret_ref text,
  hacienda_password_secret_ref text,
  certificate_secret_ref text,
  certificate_pin_secret_ref text,
  certificate_uploaded_at timestamptz,
  certificate_expires_at timestamptz,
  certificate_last4 text,
  is_complete boolean not null default false,
  last_validated_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint company_fiscal_settings_empresa_unique unique (empresa_id),
  constraint company_fiscal_settings_identification_type_check
    check (identification_type in ('01', '02', '03', '04')),
  constraint company_fiscal_settings_environment_check
    check (environment in ('testing', 'production')),
  constraint company_fiscal_settings_branch_code_check
    check (branch_code ~ '^[0-9]{3}$'),
  constraint company_fiscal_settings_terminal_code_check
    check (terminal_code ~ '^[0-9]{5}$'),
  constraint company_fiscal_settings_default_currency_check
    check (length(btrim(default_currency)) > 0),
  constraint company_fiscal_settings_secondary_activity_codes_array_check
    check (jsonb_typeof(secondary_activity_codes) = 'array')
);

create index if not exists company_fiscal_settings_empresa_id_idx
  on public.company_fiscal_settings (empresa_id);
create index if not exists company_fiscal_settings_environment_idx
  on public.company_fiscal_settings (environment);
create index if not exists company_fiscal_settings_identification_normalized_idx
  on public.company_fiscal_settings (identification_normalized);

drop trigger if exists set_company_fiscal_settings_updated_at on public.company_fiscal_settings;
create trigger set_company_fiscal_settings_updated_at
before update on public.company_fiscal_settings
for each row execute function public.set_updated_at();

create table if not exists public.fiscal_identification_types (
  code text primary key,
  label text not null,
  description text,
  is_active boolean not null default true
);

create table if not exists public.fiscal_document_types (
  code text primary key,
  name text not null,
  xml_root text,
  is_issuer_document boolean not null default true,
  is_receiver_document boolean not null default false,
  is_active boolean not null default true
);

create table if not exists public.fiscal_sale_conditions (
  code text primary key,
  label text not null,
  is_active boolean not null default true
);

create table if not exists public.fiscal_payment_methods (
  code text primary key,
  label text not null,
  supports_amount boolean not null default true,
  is_active boolean not null default true
);

create table if not exists public.fiscal_currencies (
  code text primary key,
  name text not null,
  symbol text,
  is_active boolean not null default true
);

create table if not exists public.fiscal_units (
  code text primary key,
  label text not null,
  is_active boolean not null default true
);

create table if not exists public.fiscal_tax_types (
  code text primary key,
  label text not null,
  is_active boolean not null default true
);

create table if not exists public.fiscal_tax_rates (
  code text primary key,
  tax_code text not null references public.fiscal_tax_types(code),
  label text not null,
  rate numeric(7, 4) not null,
  is_active boolean not null default true
);

create table if not exists public.fiscal_reference_codes (
  code text primary key,
  label text not null,
  applies_to text,
  is_active boolean not null default true
);

create table if not exists public.fiscal_exoneration_types (
  code text primary key,
  label text not null,
  is_active boolean not null default true
);

insert into public.fiscal_identification_types (code, label, description)
values
  ('01', 'Fisica', 'Persona fisica'),
  ('02', 'Juridica', 'Persona juridica'),
  ('03', 'DIMEX', 'Documento migratorio para extranjeros'),
  ('04', 'NITE', 'Numero de identificacion tributario especial')
on conflict (code) do update set label = excluded.label, description = excluded.description;

insert into public.fiscal_document_types (code, name, xml_root, is_issuer_document, is_receiver_document)
values
  ('01', 'Factura electronica', 'FacturaElectronica', true, false),
  ('04', 'Tiquete electronico', 'TiqueteElectronico', true, false),
  ('03', 'Nota de credito electronica', 'NotaCreditoElectronica', true, false),
  ('02', 'Nota de debito electronica', 'NotaDebitoElectronica', true, false),
  ('08', 'Factura electronica de compra', 'FacturaElectronicaCompra', true, false),
  ('09', 'Factura electronica de exportacion', 'FacturaElectronicaExportacion', true, false),
  ('10', 'Recibo electronico de pago', 'ReciboElectronicoPago', true, false),
  ('MR', 'Mensaje receptor', 'MensajeReceptor', false, true)
on conflict (code) do update
set name = excluded.name,
    xml_root = excluded.xml_root,
    is_issuer_document = excluded.is_issuer_document,
    is_receiver_document = excluded.is_receiver_document;

insert into public.fiscal_currencies (code, name, symbol)
values ('CRC', 'Colon costarricense', 'CRC'), ('USD', 'Dolar estadounidense', 'USD')
on conflict (code) do update set name = excluded.name, symbol = excluded.symbol;

insert into public.fiscal_units (code, label)
values ('Sp', 'Servicios profesionales'), ('Unid', 'Unidad'), ('Otros', 'Otros')
on conflict (code) do update set label = excluded.label;

insert into public.fiscal_tax_types (code, label)
values ('01', 'Impuesto al valor agregado')
on conflict (code) do update set label = excluded.label;

insert into public.fiscal_tax_rates (code, tax_code, label, rate)
values
  ('08', '01', 'Tarifa general 13%', 13),
  ('01', '01', 'Tarifa 0%', 0)
on conflict (code) do update set tax_code = excluded.tax_code, label = excluded.label, rate = excluded.rate;

create table if not exists public.cabys_catalog (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  description text not null,
  normalized_description text,
  category_level_1 text,
  category_level_2 text,
  category_level_3 text,
  category_level_4 text,
  category_level_5 text,
  category_level_6 text,
  category_level_7 text,
  is_good boolean,
  is_service boolean,
  suggested_tax_rate numeric(7, 4),
  tax_rate_code text references public.fiscal_tax_rates(code),
  is_active boolean not null default true,
  valid_from date,
  valid_to date,
  source_version text,
  source_hash text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists cabys_catalog_code_idx on public.cabys_catalog (code);
create index if not exists cabys_catalog_normalized_description_idx
  on public.cabys_catalog (normalized_description);
create index if not exists cabys_catalog_is_active_idx on public.cabys_catalog (is_active);
create index if not exists cabys_catalog_suggested_tax_rate_idx
  on public.cabys_catalog (suggested_tax_rate);

drop trigger if exists set_cabys_catalog_updated_at on public.cabys_catalog;
create trigger set_cabys_catalog_updated_at
before update on public.cabys_catalog
for each row execute function public.set_updated_at();

create table if not exists public.cabys_import_batches (
  id uuid primary key default gen_random_uuid(),
  source_name text,
  source_version text,
  source_url text,
  file_name text,
  file_hash text,
  total_rows integer,
  inserted_rows integer,
  updated_rows integer,
  skipped_rows integer,
  status text not null default 'pending',
  error_message text,
  imported_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  constraint cabys_import_batches_status_check
    check (status in ('pending', 'dry_run', 'imported', 'failed', 'rolled_back'))
);

create table if not exists public.catalog_product_fiscal_profile (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  product_id uuid not null references public.catalogo_productos(id) on delete cascade,
  cabys_code text references public.cabys_catalog(code),
  fiscal_unit_code text references public.fiscal_units(code),
  default_tax_code text references public.fiscal_tax_types(code),
  default_tax_rate_code text references public.fiscal_tax_rates(code),
  default_tax_rate numeric(7, 4),
  is_tax_exempt boolean not null default false,
  is_non_subject boolean not null default false,
  requires_exoneration boolean not null default false,
  requires_lot_or_serial boolean not null default false,
  requires_vin boolean not null default false,
  requires_sanitary_registration boolean not null default false,
  requires_tariff_heading boolean not null default false,
  fiscal_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint catalog_product_fiscal_profile_empresa_product_unique unique (empresa_id, product_id),
  constraint catalog_product_fiscal_profile_product_empresa_fkey
    foreign key (product_id, empresa_id)
    references public.catalogo_productos(id, empresa_id)
    on delete cascade
);

create index if not exists catalog_product_fiscal_profile_empresa_id_idx
  on public.catalog_product_fiscal_profile (empresa_id);
create index if not exists catalog_product_fiscal_profile_cabys_code_idx
  on public.catalog_product_fiscal_profile (cabys_code);

drop trigger if exists set_catalog_product_fiscal_profile_updated_at on public.catalog_product_fiscal_profile;
create trigger set_catalog_product_fiscal_profile_updated_at
before update on public.catalog_product_fiscal_profile
for each row execute function public.set_updated_at();

create table if not exists public.fiscal_documents (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  source_type text,
  source_id uuid,
  sale_id uuid references public.ventas(id) on delete set null,
  customer_id uuid references public.crm_clientes(id) on delete set null,
  document_type_code text not null references public.fiscal_document_types(code),
  status text not null default 'draft',
  hacienda_status text not null default 'no_enviado',
  environment text not null,
  clave text,
  consecutivo text,
  activity_code text,
  branch_code text,
  terminal_code text,
  issue_datetime timestamptz,
  signed_at timestamptz,
  sent_at timestamptz,
  accepted_at timestamptz,
  rejected_at timestamptz,
  currency_code text not null default 'CRC' references public.fiscal_currencies(code),
  exchange_rate numeric(14, 6),
  sale_condition_code text references public.fiscal_sale_conditions(code),
  credit_term_days integer,
  receiver_name text,
  receiver_identification_type text,
  receiver_identification_number text,
  receiver_email text,
  receiver_phone text,
  receiver_address jsonb not null default '{}'::jsonb,
  issuer_snapshot jsonb not null default '{}'::jsonb,
  receiver_snapshot jsonb not null default '{}'::jsonb,
  totals jsonb not null default '{}'::jsonb,
  validation_errors jsonb not null default '[]'::jsonb,
  last_error text,
  xml_unsigned_storage_path text,
  xml_signed_storage_path text,
  hacienda_response_storage_path text,
  pdf_storage_path text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fiscal_documents_id_empresa_unique unique (id, empresa_id),
  constraint fiscal_documents_environment_check check (environment in ('testing', 'production')),
  constraint fiscal_documents_status_check check (status in (
    'draft',
    'validated',
    'xml_generated',
    'signed',
    'sent',
    'processing',
    'accepted',
    'rejected',
    'error_validation',
    'error_xml',
    'error_signing',
    'error_sending',
    'cancelled_internal',
    'credit_noted',
    'replaced'
  )),
  constraint fiscal_documents_hacienda_status_check check (hacienda_status in (
    'no_enviado',
    'recibido',
    'procesando',
    'aceptado',
    'rechazado',
    'error',
    'desconocido'
  )),
  constraint fiscal_documents_validation_errors_array_check
    check (jsonb_typeof(validation_errors) = 'array'),
  constraint fiscal_documents_sale_empresa_fkey
    foreign key (sale_id, empresa_id)
    references public.ventas(id, empresa_id)
    on delete set null (sale_id),
  constraint fiscal_documents_customer_empresa_fkey
    foreign key (customer_id, empresa_id)
    references public.crm_clientes(id, empresa_id)
    on delete set null (customer_id)
);

create unique index if not exists fiscal_documents_empresa_clave_unique
  on public.fiscal_documents (empresa_id, clave)
  where clave is not null;
create unique index if not exists fiscal_documents_empresa_consecutivo_unique
  on public.fiscal_documents (empresa_id, consecutivo, document_type_code, environment)
  where consecutivo is not null;
create index if not exists fiscal_documents_empresa_id_idx on public.fiscal_documents (empresa_id);
create index if not exists fiscal_documents_document_type_code_idx on public.fiscal_documents (document_type_code);
create index if not exists fiscal_documents_status_idx on public.fiscal_documents (status);
create index if not exists fiscal_documents_hacienda_status_idx on public.fiscal_documents (hacienda_status);
create index if not exists fiscal_documents_customer_id_idx on public.fiscal_documents (customer_id);
create index if not exists fiscal_documents_sale_id_idx on public.fiscal_documents (sale_id);
create index if not exists fiscal_documents_issue_datetime_idx on public.fiscal_documents (issue_datetime);
create index if not exists fiscal_documents_created_at_idx on public.fiscal_documents (created_at);

drop trigger if exists set_fiscal_documents_updated_at on public.fiscal_documents;
create trigger set_fiscal_documents_updated_at
before update on public.fiscal_documents
for each row execute function public.set_updated_at();

create table if not exists public.fiscal_document_artifacts (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  fiscal_document_id uuid not null,
  artifact_type text not null,
  storage_path text,
  content_text text,
  content_mime_type text not null default 'application/xml',
  sha256 text,
  status text not null default 'generated',
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fiscal_document_artifacts_document_fkey
    foreign key (fiscal_document_id, empresa_id)
    references public.fiscal_documents(id, empresa_id)
    on delete cascade,
  constraint fiscal_document_artifacts_type_check check (artifact_type in (
    'xml_unsigned',
    'xml_signed',
    'hacienda_response',
    'pdf_representation',
    'pdf'
  )),
  constraint fiscal_document_artifacts_status_check check (status in (
    'generated',
    'stored',
    'superseded',
    'error'
  ))
);

create index if not exists fiscal_document_artifacts_document_idx
  on public.fiscal_document_artifacts (empresa_id, fiscal_document_id);

drop trigger if exists set_fiscal_document_artifacts_updated_at on public.fiscal_document_artifacts;
create trigger set_fiscal_document_artifacts_updated_at
before update on public.fiscal_document_artifacts
for each row execute function public.set_updated_at();

create table if not exists public.fiscal_document_lines (
  id uuid primary key default gen_random_uuid(),
  fiscal_document_id uuid not null references public.fiscal_documents(id) on delete cascade,
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  line_number integer not null,
  source_item_id uuid,
  product_id uuid references public.catalogo_productos(id) on delete set null,
  cabys_code text references public.cabys_catalog(code),
  commercial_code text,
  quantity numeric(14, 4) not null,
  unit_code text not null references public.fiscal_units(code),
  commercial_unit text,
  detail text not null,
  unit_price numeric(14, 4) not null,
  gross_amount numeric(14, 4) not null,
  discount_amount numeric(14, 4) not null default 0,
  discount_reason text,
  subtotal numeric(14, 4) not null,
  taxable_base numeric(14, 4),
  tax_amount numeric(14, 4) not null default 0,
  total_line_amount numeric(14, 4) not null,
  is_good boolean,
  is_service boolean,
  is_exempt boolean not null default false,
  is_non_subject boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint fiscal_document_lines_id_empresa_unique unique (id, empresa_id),
  constraint fiscal_document_lines_document_empresa_fkey
    foreign key (fiscal_document_id, empresa_id)
    references public.fiscal_documents(id, empresa_id)
    on delete cascade,
  constraint fiscal_document_lines_quantity_check check (quantity > 0),
  constraint fiscal_document_lines_unit_price_check check (unit_price >= 0),
  constraint fiscal_document_lines_discount_amount_check check (discount_amount >= 0),
  constraint fiscal_document_lines_line_unique unique (fiscal_document_id, line_number)
);

create index if not exists fiscal_document_lines_empresa_id_idx on public.fiscal_document_lines (empresa_id);
create index if not exists fiscal_document_lines_document_id_idx on public.fiscal_document_lines (fiscal_document_id);
create index if not exists fiscal_document_lines_product_id_idx on public.fiscal_document_lines (product_id);
create index if not exists fiscal_document_lines_cabys_code_idx on public.fiscal_document_lines (cabys_code);

create table if not exists public.fiscal_document_line_exonerations (
  id uuid primary key default gen_random_uuid(),
  fiscal_document_line_id uuid not null references public.fiscal_document_lines(id) on delete cascade,
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  exoneration_type_code text references public.fiscal_exoneration_types(code),
  document_number text,
  institution_name text,
  issue_date date,
  exemption_percentage numeric(7, 4),
  exemption_amount numeric(14, 4),
  metadata jsonb not null default '{}'::jsonb,
  constraint fiscal_document_line_exonerations_line_empresa_fkey
    foreign key (fiscal_document_line_id, empresa_id)
    references public.fiscal_document_lines(id, empresa_id)
    on delete cascade
);

create table if not exists public.fiscal_document_line_taxes (
  id uuid primary key default gen_random_uuid(),
  fiscal_document_line_id uuid not null references public.fiscal_document_lines(id) on delete cascade,
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  tax_code text not null references public.fiscal_tax_types(code),
  tax_rate_code text references public.fiscal_tax_rates(code),
  rate numeric(7, 4),
  amount numeric(14, 4) not null,
  taxable_base numeric(14, 4),
  exoneration_id uuid references public.fiscal_document_line_exonerations(id),
  metadata jsonb not null default '{}'::jsonb,
  constraint fiscal_document_line_taxes_line_empresa_fkey
    foreign key (fiscal_document_line_id, empresa_id)
    references public.fiscal_document_lines(id, empresa_id)
    on delete cascade,
  constraint fiscal_document_line_taxes_amount_check check (amount >= 0)
);

create table if not exists public.fiscal_document_payments (
  id uuid primary key default gen_random_uuid(),
  fiscal_document_id uuid not null references public.fiscal_documents(id) on delete cascade,
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  payment_method_code text not null references public.fiscal_payment_methods(code),
  amount numeric(14, 4) not null,
  metadata jsonb not null default '{}'::jsonb,
  constraint fiscal_document_payments_document_empresa_fkey
    foreign key (fiscal_document_id, empresa_id)
    references public.fiscal_documents(id, empresa_id)
    on delete cascade,
  constraint fiscal_document_payments_amount_check check (amount >= 0)
);

create table if not exists public.fiscal_document_references (
  id uuid primary key default gen_random_uuid(),
  fiscal_document_id uuid not null references public.fiscal_documents(id) on delete cascade,
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  reference_document_type_code text references public.fiscal_document_types(code),
  reference_clave text,
  reference_consecutivo text,
  reference_issue_date timestamptz,
  reference_code text references public.fiscal_reference_codes(code),
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  constraint fiscal_document_references_document_empresa_fkey
    foreign key (fiscal_document_id, empresa_id)
    references public.fiscal_documents(id, empresa_id)
    on delete cascade
);

create table if not exists public.fiscal_document_events (
  id uuid primary key default gen_random_uuid(),
  fiscal_document_id uuid not null references public.fiscal_documents(id) on delete cascade,
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  event_type text not null,
  from_status text,
  to_status text,
  message text,
  details jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  constraint fiscal_document_events_document_empresa_fkey
    foreign key (fiscal_document_id, empresa_id)
    references public.fiscal_documents(id, empresa_id)
    on delete cascade
);

create table if not exists public.fiscal_sequence_counters (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  environment text not null,
  branch_code text not null,
  terminal_code text not null,
  document_type_code text not null references public.fiscal_document_types(code),
  current_number bigint not null default 0,
  next_number bigint not null default 1,
  last_reserved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fiscal_sequence_counters_unique unique (empresa_id, environment, branch_code, terminal_code, document_type_code),
  constraint fiscal_sequence_counters_environment_check check (environment in ('testing', 'production')),
  constraint fiscal_sequence_counters_branch_code_check check (branch_code ~ '^[0-9]{3}$'),
  constraint fiscal_sequence_counters_terminal_code_check check (terminal_code ~ '^[0-9]{5}$'),
  constraint fiscal_sequence_counters_numbers_check check (current_number >= 0 and next_number > current_number)
);

create table if not exists public.fiscal_sequence_reservations (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  fiscal_document_id uuid references public.fiscal_documents(id) on delete set null,
  environment text not null,
  branch_code text not null,
  terminal_code text not null,
  document_type_code text not null references public.fiscal_document_types(code),
  sequence_number bigint not null,
  consecutivo text not null,
  clave text,
  status text not null default 'reserved',
  reserved_at timestamptz not null default now(),
  used_at timestamptz,
  voided_at timestamptz,
  reason text,
  constraint fiscal_sequence_reservations_status_check
    check (status in ('reserved', 'used', 'voided', 'failed_before_signing', 'failed_after_signing')),
  constraint fiscal_sequence_reservations_unique unique (empresa_id, environment, branch_code, terminal_code, document_type_code, sequence_number),
  constraint fiscal_sequence_reservations_consecutivo_unique unique (empresa_id, environment, consecutivo)
);

create index if not exists fiscal_sequence_counters_empresa_id_idx on public.fiscal_sequence_counters (empresa_id);
create index if not exists fiscal_sequence_reservations_empresa_id_idx on public.fiscal_sequence_reservations (empresa_id);
create index if not exists fiscal_sequence_reservations_document_id_idx on public.fiscal_sequence_reservations (fiscal_document_id);

drop trigger if exists set_fiscal_sequence_counters_updated_at on public.fiscal_sequence_counters;
create trigger set_fiscal_sequence_counters_updated_at
before update on public.fiscal_sequence_counters
for each row execute function public.set_updated_at();

create table if not exists public.fiscal_received_documents (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  supplier_id uuid,
  clave text,
  consecutivo text,
  issuer_name text,
  issuer_identification text,
  issue_datetime timestamptz,
  total_amount numeric(14, 4),
  currency_code text references public.fiscal_currencies(code),
  hacienda_status text,
  receiver_response_status text not null default 'pending',
  xml_storage_path text,
  parsed_data jsonb not null default '{}'::jsonb,
  validation_errors jsonb not null default '[]'::jsonb,
  linked_purchase_id uuid,
  linked_payable_account_id uuid,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fiscal_received_documents_response_status_check
    check (receiver_response_status in ('pending', 'accepted', 'partially_accepted', 'rejected', 'sent', 'error')),
  constraint fiscal_received_documents_validation_errors_array_check
    check (jsonb_typeof(validation_errors) = 'array')
);

create unique index if not exists fiscal_received_documents_empresa_clave_unique
  on public.fiscal_received_documents (empresa_id, clave)
  where clave is not null;

create table if not exists public.fiscal_received_document_artifacts (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  fiscal_received_document_id uuid not null,
  artifact_type text not null,
  storage_path text,
  content_text text,
  content_mime_type text not null default 'application/xml',
  sha256 text,
  status text not null default 'stored',
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fiscal_received_document_artifacts_document_fkey
    foreign key (fiscal_received_document_id, empresa_id)
    references public.fiscal_received_documents(id, empresa_id)
    on delete cascade,
  constraint fiscal_received_document_artifacts_type_check check (artifact_type in (
    'xml_received',
    'receiver_message',
    'hacienda_response'
  )),
  constraint fiscal_received_document_artifacts_status_check check (status in (
    'stored',
    'generated',
    'sent',
    'error'
  ))
);

create index if not exists fiscal_received_document_artifacts_document_idx
  on public.fiscal_received_document_artifacts (empresa_id, fiscal_received_document_id);

create table if not exists public.product_fiscal_special_fields (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  product_id uuid not null references public.catalogo_productos(id) on delete cascade,
  field_type text not null,
  value text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_fiscal_special_fields_type_check check (field_type in (
    'vin',
    'serial_number',
    'sanitary_registration',
    'pharmaceutical_form',
    'tariff_heading',
    'component_detail',
    'alcohol_tax_info',
    'other'
  )),
  constraint product_fiscal_special_fields_product_empresa_fkey
    foreign key (product_id, empresa_id)
    references public.catalogo_productos(id, empresa_id)
    on delete cascade
);

create table if not exists public.fiscal_document_deliveries (
  id uuid primary key default gen_random_uuid(),
  fiscal_document_id uuid not null references public.fiscal_documents(id) on delete cascade,
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  recipient_email text not null,
  delivery_type text not null,
  status text not null,
  sent_at timestamptz,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint fiscal_document_deliveries_type_check check (delivery_type in ('email', 'download', 'manual')),
  constraint fiscal_document_deliveries_status_check check (status in ('pending', 'sent', 'failed')),
  constraint fiscal_document_deliveries_document_empresa_fkey
    foreign key (fiscal_document_id, empresa_id)
    references public.fiscal_documents(id, empresa_id)
    on delete cascade
);

drop trigger if exists set_fiscal_received_documents_updated_at on public.fiscal_received_documents;
create trigger set_fiscal_received_documents_updated_at
before update on public.fiscal_received_documents
for each row execute function public.set_updated_at();

drop trigger if exists set_fiscal_received_document_artifacts_updated_at on public.fiscal_received_document_artifacts;
create trigger set_fiscal_received_document_artifacts_updated_at
before update on public.fiscal_received_document_artifacts
for each row execute function public.set_updated_at();

drop trigger if exists set_product_fiscal_special_fields_updated_at on public.product_fiscal_special_fields;
create trigger set_product_fiscal_special_fields_updated_at
before update on public.product_fiscal_special_fields
for each row execute function public.set_updated_at();

alter table public.company_fiscal_settings enable row level security;
alter table public.fiscal_identification_types enable row level security;
alter table public.fiscal_document_types enable row level security;
alter table public.fiscal_sale_conditions enable row level security;
alter table public.fiscal_payment_methods enable row level security;
alter table public.fiscal_currencies enable row level security;
alter table public.fiscal_units enable row level security;
alter table public.fiscal_tax_types enable row level security;
alter table public.fiscal_tax_rates enable row level security;
alter table public.fiscal_reference_codes enable row level security;
alter table public.fiscal_exoneration_types enable row level security;
alter table public.cabys_catalog enable row level security;
alter table public.cabys_import_batches enable row level security;
alter table public.catalog_product_fiscal_profile enable row level security;
alter table public.fiscal_documents enable row level security;
alter table public.fiscal_document_artifacts enable row level security;
alter table public.fiscal_document_lines enable row level security;
alter table public.fiscal_document_line_exonerations enable row level security;
alter table public.fiscal_document_line_taxes enable row level security;
alter table public.fiscal_document_payments enable row level security;
alter table public.fiscal_document_references enable row level security;
alter table public.fiscal_document_events enable row level security;
alter table public.fiscal_sequence_counters enable row level security;
alter table public.fiscal_sequence_reservations enable row level security;
alter table public.fiscal_received_documents enable row level security;
alter table public.fiscal_received_document_artifacts enable row level security;
alter table public.product_fiscal_special_fields enable row level security;
alter table public.fiscal_document_deliveries enable row level security;

grant select on
  public.company_fiscal_settings,
  public.fiscal_identification_types,
  public.fiscal_document_types,
  public.fiscal_sale_conditions,
  public.fiscal_payment_methods,
  public.fiscal_currencies,
  public.fiscal_units,
  public.fiscal_tax_types,
  public.fiscal_tax_rates,
  public.fiscal_reference_codes,
  public.fiscal_exoneration_types,
  public.cabys_catalog,
  public.cabys_import_batches,
  public.catalog_product_fiscal_profile,
  public.fiscal_documents,
  public.fiscal_document_artifacts,
  public.fiscal_document_lines,
  public.fiscal_document_line_exonerations,
  public.fiscal_document_line_taxes,
  public.fiscal_document_payments,
  public.fiscal_document_references,
  public.fiscal_document_events,
  public.fiscal_sequence_counters,
  public.fiscal_sequence_reservations,
  public.fiscal_received_documents,
  public.fiscal_received_document_artifacts,
  public.product_fiscal_special_fields,
  public.fiscal_document_deliveries
to authenticated;

grant insert, update on
  public.company_fiscal_settings,
  public.cabys_catalog,
  public.cabys_import_batches,
  public.catalog_product_fiscal_profile,
  public.fiscal_documents,
  public.fiscal_document_artifacts,
  public.fiscal_document_lines,
  public.fiscal_document_line_exonerations,
  public.fiscal_document_line_taxes,
  public.fiscal_document_payments,
  public.fiscal_document_references,
  public.fiscal_document_events,
  public.fiscal_sequence_counters,
  public.fiscal_sequence_reservations,
  public.fiscal_received_documents,
  public.fiscal_received_document_artifacts,
  public.product_fiscal_special_fields,
  public.fiscal_document_deliveries
to authenticated;

drop policy if exists fiscal_catalogs_select_authenticated on public.fiscal_identification_types;
create policy fiscal_catalogs_select_authenticated
on public.fiscal_identification_types for select to authenticated using (true);
drop policy if exists fiscal_document_types_select_authenticated on public.fiscal_document_types;
create policy fiscal_document_types_select_authenticated
on public.fiscal_document_types for select to authenticated using (true);
drop policy if exists fiscal_sale_conditions_select_authenticated on public.fiscal_sale_conditions;
create policy fiscal_sale_conditions_select_authenticated
on public.fiscal_sale_conditions for select to authenticated using (true);
drop policy if exists fiscal_payment_methods_select_authenticated on public.fiscal_payment_methods;
create policy fiscal_payment_methods_select_authenticated
on public.fiscal_payment_methods for select to authenticated using (true);
drop policy if exists fiscal_currencies_select_authenticated on public.fiscal_currencies;
create policy fiscal_currencies_select_authenticated
on public.fiscal_currencies for select to authenticated using (true);
drop policy if exists fiscal_units_select_authenticated on public.fiscal_units;
create policy fiscal_units_select_authenticated
on public.fiscal_units for select to authenticated using (true);
drop policy if exists fiscal_tax_types_select_authenticated on public.fiscal_tax_types;
create policy fiscal_tax_types_select_authenticated
on public.fiscal_tax_types for select to authenticated using (true);
drop policy if exists fiscal_tax_rates_select_authenticated on public.fiscal_tax_rates;
create policy fiscal_tax_rates_select_authenticated
on public.fiscal_tax_rates for select to authenticated using (true);
drop policy if exists fiscal_reference_codes_select_authenticated on public.fiscal_reference_codes;
create policy fiscal_reference_codes_select_authenticated
on public.fiscal_reference_codes for select to authenticated using (true);
drop policy if exists fiscal_exoneration_types_select_authenticated on public.fiscal_exoneration_types;
create policy fiscal_exoneration_types_select_authenticated
on public.fiscal_exoneration_types for select to authenticated using (true);

drop policy if exists cabys_catalog_select_billing on public.cabys_catalog;
create policy cabys_catalog_select_billing
on public.cabys_catalog for select to authenticated
using (
  (select public.current_user_has_permission('billing.view'))
  or (select public.current_user_has_permission('billing.cabys.manage'))
  or (select public.current_user_has_permission('billing.invoices.view'))
);

drop policy if exists cabys_catalog_write_billing on public.cabys_catalog;
create policy cabys_catalog_write_billing
on public.cabys_catalog for all to authenticated
using ((select public.current_user_has_permission('billing.cabys.manage')))
with check ((select public.current_user_has_permission('billing.cabys.manage')));

drop policy if exists cabys_import_batches_select_billing on public.cabys_import_batches;
create policy cabys_import_batches_select_billing
on public.cabys_import_batches for select to authenticated
using ((select public.current_user_has_permission('billing.cabys.manage')));

drop policy if exists cabys_import_batches_insert_billing on public.cabys_import_batches;
create policy cabys_import_batches_insert_billing
on public.cabys_import_batches for insert to authenticated
with check ((select public.current_user_has_permission('billing.cabys.manage')));

drop policy if exists company_fiscal_settings_select_company on public.company_fiscal_settings;
create policy company_fiscal_settings_select_company
on public.company_fiscal_settings for select to authenticated
using (
  empresa_id = (select public.current_empresa_id())
  and (
    (select public.current_user_has_permission('billing.config.view'))
    or (select public.current_user_has_permission('billing.config.manage'))
    or (select public.current_user_has_permission('billing.fiscal.view'))
    or (select public.current_user_has_permission('billing.fiscal.manage'))
  )
);

drop policy if exists company_fiscal_settings_write_company on public.company_fiscal_settings;
create policy company_fiscal_settings_write_company
on public.company_fiscal_settings for all to authenticated
using (
  empresa_id = (select public.current_empresa_id())
  and (
    (select public.current_user_has_permission('billing.config.manage'))
    or (select public.current_user_has_permission('billing.fiscal.manage'))
  )
)
with check (
  empresa_id = (select public.current_empresa_id())
  and (
    (select public.current_user_has_permission('billing.config.manage'))
    or (select public.current_user_has_permission('billing.fiscal.manage'))
  )
);

drop policy if exists catalog_product_fiscal_profile_select_company on public.catalog_product_fiscal_profile;
create policy catalog_product_fiscal_profile_select_company
on public.catalog_product_fiscal_profile for select to authenticated
using (
  empresa_id = (select public.current_empresa_id())
  and (
    (select public.current_user_has_permission('billing.view'))
    or (select public.current_user_has_permission('billing.issue'))
    or (select public.current_user_has_permission('billing.cabys.manage'))
  )
);

drop policy if exists catalog_product_fiscal_profile_write_company on public.catalog_product_fiscal_profile;
create policy catalog_product_fiscal_profile_write_company
on public.catalog_product_fiscal_profile for all to authenticated
using (
  empresa_id = (select public.current_empresa_id())
  and (select public.current_user_has_permission('billing.cabys.manage'))
)
with check (
  empresa_id = (select public.current_empresa_id())
  and (select public.current_user_has_permission('billing.cabys.manage'))
);

drop policy if exists fiscal_documents_select_company on public.fiscal_documents;
create policy fiscal_documents_select_company
on public.fiscal_documents for select to authenticated
using (
  empresa_id = (select public.current_empresa_id())
  and (
    (select public.current_user_has_permission('billing.view'))
    or (select public.current_user_has_permission('billing.issue'))
    or (select public.current_user_has_permission('billing.invoices.view'))
    or (select public.current_user_has_permission('billing.invoices.create'))
  )
);

drop policy if exists fiscal_documents_write_company on public.fiscal_documents;
create policy fiscal_documents_write_company
on public.fiscal_documents for all to authenticated
using (
  empresa_id = (select public.current_empresa_id())
  and (
    (select public.current_user_has_permission('billing.issue'))
    or (select public.current_user_has_permission('billing.invoices.create'))
  )
)
with check (
  empresa_id = (select public.current_empresa_id())
  and (
    (select public.current_user_has_permission('billing.issue'))
    or (select public.current_user_has_permission('billing.invoices.create'))
  )
);

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'fiscal_document_artifacts',
    'fiscal_document_lines',
    'fiscal_document_line_exonerations',
    'fiscal_document_line_taxes',
    'fiscal_document_payments',
    'fiscal_document_references',
    'fiscal_document_events',
    'fiscal_sequence_counters',
    'fiscal_sequence_reservations',
    'fiscal_received_documents',
    'fiscal_received_document_artifacts',
    'product_fiscal_special_fields',
    'fiscal_document_deliveries'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', v_table || '_select_company', v_table);
    execute format(
      'create policy %I on public.%I for select to authenticated using (empresa_id = (select public.current_empresa_id()) and ((select public.current_user_has_permission(''billing.view'')) or (select public.current_user_has_permission(''billing.issue'')) or (select public.current_user_has_permission(''billing.invoices.view'')) or (select public.current_user_has_permission(''billing.invoices.create'')) or (select public.current_user_has_permission(''billing.receive''))))',
      v_table || '_select_company',
      v_table
    );

    execute format('drop policy if exists %I on public.%I', v_table || '_write_company', v_table);
    execute format(
      'create policy %I on public.%I for all to authenticated using (empresa_id = (select public.current_empresa_id()) and ((select public.current_user_has_permission(''billing.issue'')) or (select public.current_user_has_permission(''billing.invoices.create'')) or (select public.current_user_has_permission(''billing.receive'')))) with check (empresa_id = (select public.current_empresa_id()) and ((select public.current_user_has_permission(''billing.issue'')) or (select public.current_user_has_permission(''billing.invoices.create'')) or (select public.current_user_has_permission(''billing.receive''))))',
      v_table || '_write_company',
      v_table
    );
  end loop;
end $$;

drop policy if exists fiscal_documents_select_platform_console on public.fiscal_documents;
create policy fiscal_documents_select_platform_console
on public.fiscal_documents for select to authenticated
using (public.current_user_is_platform_user(null));

drop policy if exists company_fiscal_settings_select_platform_console on public.company_fiscal_settings;
create policy company_fiscal_settings_select_platform_console
on public.company_fiscal_settings for select to authenticated
using (public.current_user_is_platform_user(null));

create or replace function public.billing_config_status_for_company(p_empresa_id uuid)
returns text
language sql
security definer
set search_path = ''
as $$
  select case
    when p_empresa_id is null then 'missing'
    when not exists (
      select 1 from public.company_fiscal_settings cfs where cfs.empresa_id = p_empresa_id
    ) and not exists (
      select 1 from public.configuraciones_empresa ce where ce.empresa_id = p_empresa_id and ce.clave = 'fiscal'
    ) then 'missing'
    when exists (
      select 1
      from public.company_fiscal_settings cfs
      where cfs.empresa_id = p_empresa_id
        and nullif(cfs.legal_name, '') is not null
        and nullif(cfs.identification_number, '') is not null
        and nullif(cfs.email, '') is not null
        and nullif(cfs.main_activity_code, '') is not null
        and nullif(cfs.branch_code, '') is not null
        and nullif(cfs.terminal_code, '') is not null
        and nullif(cfs.certificate_secret_ref, '') is not null
        and nullif(cfs.certificate_pin_secret_ref, '') is not null
        and nullif(cfs.hacienda_username_secret_ref, '') is not null
        and nullif(cfs.hacienda_password_secret_ref, '') is not null
    ) then 'ready_for_hacienda'
    when exists (
      select 1
      from public.configuraciones_empresa ce
      where ce.empresa_id = p_empresa_id
        and ce.clave = 'fiscal'
        and nullif(ce.valor->>'razonSocial', '') is not null
        and nullif(ce.valor->>'identificacion', '') is not null
        and nullif(ce.valor->>'correoEmisor', '') is not null
        and nullif(ce.valor->>'actividadEconomica', '') is not null
        and nullif(ce.valor->>'p12Base64Enc', '') is not null
        and nullif(ce.valor->>'pinEnc', '') is not null
        and nullif(ce.valor->>'haciendaUsuarioEnc', '') is not null
        and nullif(ce.valor->>'haciendaPasswordEnc', '') is not null
    ) then 'ready_for_hacienda'
    when exists (
      select 1 from public.company_fiscal_settings cfs where cfs.empresa_id = p_empresa_id
    ) or exists (
      select 1 from public.configuraciones_empresa ce where ce.empresa_id = p_empresa_id and ce.clave = 'fiscal'
    ) then 'incomplete'
    else 'missing'
  end;
$$;

create or replace function public.get_platform_billing_health(p_empresa_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
  v_result jsonb;
begin
  if not public.current_user_is_platform_user(null) then
    raise exception 'Platform access required.' using errcode = '42501';
  end if;

  v_status := public.billing_config_status_for_company(p_empresa_id);

  select jsonb_build_object(
    'empresaId', p_empresa_id,
    'billingConfigStatus', v_status,
    'configurationComplete', v_status in ('ready_for_xml', 'ready_for_signing', 'ready_for_hacienda'),
    'credentialsPresent', v_status = 'ready_for_hacienda',
    'certificatePresent', exists (
      select 1
      from public.company_fiscal_settings cfs
      where cfs.empresa_id = p_empresa_id
        and nullif(cfs.certificate_secret_ref, '') is not null
    ) or exists (
      select 1
      from public.configuraciones_empresa ce
      where ce.empresa_id = p_empresa_id
        and ce.clave = 'fiscal'
        and nullif(ce.valor->>'p12Base64Enc', '') is not null
    ),
    'lastHaciendaStatus', (
      select fd.hacienda_status
      from public.fiscal_documents fd
      where fd.empresa_id = p_empresa_id
      order by fd.updated_at desc
      limit 1
    ),
    'lastError', (
      select fd.last_error
      from public.fiscal_documents fd
      where fd.empresa_id = p_empresa_id
        and nullif(fd.last_error, '') is not null
      order by fd.updated_at desc
      limit 1
    ),
    'documentCounts', coalesce((
      select jsonb_object_agg(status, total)
      from (
        select fd.status, count(*) as total
        from public.fiscal_documents fd
        where fd.empresa_id = p_empresa_id
        group by fd.status
      ) counts
    ), '{}'::jsonb),
    'artifactCounts', coalesce((
      select jsonb_object_agg(artifact_type, total)
      from (
        select fda.artifact_type, count(*) as total
        from public.fiscal_document_artifacts fda
        where fda.empresa_id = p_empresa_id
        group by fda.artifact_type
      ) counts
    ), '{}'::jsonb),
    'receivedDocumentCounts', coalesce((
      select jsonb_object_agg(receiver_response_status, total)
      from (
        select frd.receiver_response_status, count(*) as total
        from public.fiscal_received_documents frd
        where frd.empresa_id = p_empresa_id
        group by frd.receiver_response_status
      ) counts
    ), '{}'::jsonb),
    'receivedArtifactCounts', coalesce((
      select jsonb_object_agg(artifact_type, total)
      from (
        select frda.artifact_type, count(*) as total
        from public.fiscal_received_document_artifacts frda
        where frda.empresa_id = p_empresa_id
        group by frda.artifact_type
      ) counts
    ), '{}'::jsonb),
    'lastReceivedValidationErrors', coalesce((
      select frd.validation_errors
      from public.fiscal_received_documents frd
      where frd.empresa_id = p_empresa_id
        and jsonb_array_length(frd.validation_errors) > 0
      order by frd.updated_at desc
      limit 1
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

create or replace function public.generate_fiscal_consecutivo(
  p_branch_code text,
  p_terminal_code text,
  p_document_type_code text,
  p_sequence_number bigint
)
returns text
language sql
immutable
as $$
  select lpad(p_branch_code, 3, '0')
    || lpad(p_terminal_code, 5, '0')
    || lpad(p_document_type_code, 2, '0')
    || lpad(p_sequence_number::text, 10, '0');
$$;

create or replace function public.reserve_fiscal_sequence_for_current_company(
  p_document_type_code text,
  p_environment text default null,
  p_branch_code text default null,
  p_terminal_code text default null
)
returns table (reservation_id uuid, consecutivo text, sequence_number bigint)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_empresa_id uuid := public.current_empresa_id();
  v_counter public.fiscal_sequence_counters%rowtype;
  v_environment text;
  v_branch_code text;
  v_terminal_code text;
  v_consecutivo text;
  v_reservation public.fiscal_sequence_reservations%rowtype;
begin
  if v_user_id is null or v_empresa_id is null then
    raise exception 'Usuario autenticado requerido.' using errcode = '28000';
  end if;

  if not (
    public.current_user_has_permission('billing.issue')
    or public.current_user_has_permission('billing.invoices.create')
  ) then
    raise exception 'Permiso billing.issue requerido.' using errcode = '42501';
  end if;

  select cfs.environment, cfs.branch_code, cfs.terminal_code
  into v_environment, v_branch_code, v_terminal_code
  from public.company_fiscal_settings cfs
  where cfs.empresa_id = v_empresa_id;

  v_environment := coalesce(nullif(p_environment, ''), v_environment, 'testing');
  v_branch_code := coalesce(nullif(p_branch_code, ''), v_branch_code, '001');
  v_terminal_code := coalesce(nullif(p_terminal_code, ''), v_terminal_code, '00001');

  if v_environment not in ('testing', 'production') then
    raise exception 'Ambiente fiscal invalido.' using errcode = '22023';
  end if;

  if not exists (select 1 from public.fiscal_document_types fdt where fdt.code = p_document_type_code) then
    raise exception 'Tipo documental fiscal invalido.' using errcode = '22023';
  end if;

  insert into public.fiscal_sequence_counters (
    empresa_id,
    environment,
    branch_code,
    terminal_code,
    document_type_code
  )
  values (
    v_empresa_id,
    v_environment,
    v_branch_code,
    v_terminal_code,
    p_document_type_code
  )
  on conflict on constraint fiscal_sequence_counters_unique
  do nothing;

  select *
  into v_counter
  from public.fiscal_sequence_counters fsc
  where fsc.empresa_id = v_empresa_id
    and fsc.environment = v_environment
    and fsc.branch_code = v_branch_code
    and fsc.terminal_code = v_terminal_code
    and fsc.document_type_code = p_document_type_code
  for update;

  v_consecutivo := public.generate_fiscal_consecutivo(
    v_branch_code,
    v_terminal_code,
    p_document_type_code,
    v_counter.next_number
  );

  update public.fiscal_sequence_counters fsc
  set
    current_number = v_counter.next_number,
    next_number = v_counter.next_number + 1,
    last_reserved_at = now()
  where fsc.id = v_counter.id;

  insert into public.fiscal_sequence_reservations (
    empresa_id,
    environment,
    branch_code,
    terminal_code,
    document_type_code,
    sequence_number,
    consecutivo,
    status
  )
  values (
    v_empresa_id,
    v_environment,
    v_branch_code,
    v_terminal_code,
    p_document_type_code,
    v_counter.next_number,
    v_consecutivo,
    'reserved'
  )
  returning * into v_reservation;

  return query select v_reservation.id, v_reservation.consecutivo, v_reservation.sequence_number;
end;
$$;

create or replace function public.prepare_fiscal_document_from_sale(
  p_sale_id uuid,
  p_document_type_code text default '01'
)
returns table (document_id uuid, status text, validation_errors jsonb)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_empresa_id uuid := public.current_empresa_id();
  v_sale public.ventas%rowtype;
  v_customer public.crm_clientes%rowtype;
  v_config jsonb := '{}'::jsonb;
  v_settings public.company_fiscal_settings%rowtype;
  v_environment text := 'testing';
  v_branch_code text := '001';
  v_terminal_code text := '00001';
  v_issuer_snapshot jsonb;
  v_receiver_snapshot jsonb;
  v_errors jsonb := '[]'::jsonb;
  v_document public.fiscal_documents%rowtype;
begin
  if v_user_id is null or v_empresa_id is null then
    raise exception 'Usuario autenticado requerido.' using errcode = '28000';
  end if;

  if not (
    public.current_user_has_permission('billing.issue')
    or public.current_user_has_permission('billing.invoices.create')
  ) then
    raise exception 'Permiso billing.issue requerido.' using errcode = '42501';
  end if;

  if p_document_type_code not in ('01', '04') then
    raise exception 'Tipo documental no disponible para preparar desde venta.' using errcode = '22023';
  end if;

  select v.* into v_sale
  from public.ventas v
  where v.id = p_sale_id
    and v.empresa_id = v_empresa_id;

  if v_sale.id is null then
    raise exception 'Venta no encontrada.' using errcode = '02000';
  end if;

  if v_sale.estado not in ('confirmada', 'en_proceso', 'completada') then
    raise exception 'La venta debe estar confirmada antes de preparar documento fiscal.' using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.fiscal_documents fd
    where fd.empresa_id = v_empresa_id
      and fd.sale_id = p_sale_id
      and fd.status not in ('error_validation', 'cancelled_internal', 'replaced')
  ) then
    raise exception 'Ya existe un documento fiscal activo para esta venta.' using errcode = '23505';
  end if;

  select c.* into v_customer
  from public.crm_clientes c
  where c.id = v_sale.cliente_id
    and c.empresa_id = v_empresa_id;

  select cfs.* into v_settings
  from public.company_fiscal_settings cfs
  where cfs.empresa_id = v_empresa_id;

  select ce.valor into v_config
  from public.configuraciones_empresa ce
  where ce.empresa_id = v_empresa_id
    and ce.clave = 'fiscal';

  v_environment := coalesce(
    v_settings.environment,
    case when v_config->>'ambiente' = 'produccion' then 'production' else 'testing' end
  );
  v_branch_code := coalesce(v_settings.branch_code, nullif(v_config->>'sucursal', ''), '001');
  v_terminal_code := coalesce(v_settings.terminal_code, nullif(v_config->>'terminal', ''), '00001');

  if coalesce(v_settings.legal_name, nullif(v_config->>'razonSocial', '')) is null then
    v_errors := v_errors || jsonb_build_array(jsonb_build_object(
      'group', 'Empresa',
      'code', 'missing_legal_name',
      'message', 'Falta razon social en configuracion fiscal.'
    ));
  end if;

  if coalesce(v_settings.identification_number, nullif(v_config->>'identificacion', '')) is null then
    v_errors := v_errors || jsonb_build_array(jsonb_build_object(
      'group', 'Empresa',
      'code', 'missing_identification',
      'message', 'Falta identificacion fiscal del emisor.'
    ));
  end if;

  if coalesce(v_settings.main_activity_code, nullif(v_config->>'actividadEconomica', '')) is null then
    v_errors := v_errors || jsonb_build_array(jsonb_build_object(
      'group', 'Empresa',
      'code', 'missing_activity',
      'message', 'Falta actividad economica del emisor.'
    ));
  end if;

  if p_document_type_code = '01' and (v_customer.id is null or nullif(v_customer.identificacion, '') is null) then
    v_errors := v_errors || jsonb_build_array(jsonb_build_object(
      'group', 'Cliente',
      'code', 'missing_customer_identification',
      'message', 'La factura electronica requiere receptor identificado.'
    ));
  end if;

  if not exists (
    select 1 from public.venta_items vi where vi.empresa_id = v_empresa_id and vi.venta_id = p_sale_id
  ) then
    v_errors := v_errors || jsonb_build_array(jsonb_build_object(
      'group', 'Productos/CABYS',
      'code', 'missing_lines',
      'message', 'La venta no tiene lineas para facturar.'
    ));
  end if;

  if exists (
    select 1
    from public.venta_items vi
    left join public.catalog_product_fiscal_profile fp
      on fp.empresa_id = vi.empresa_id
     and fp.product_id = vi.producto_id
    where vi.empresa_id = v_empresa_id
      and vi.venta_id = p_sale_id
      and vi.producto_id is not null
      and nullif(fp.cabys_code, '') is null
  ) then
    v_errors := v_errors || jsonb_build_array(jsonb_build_object(
      'group', 'Productos/CABYS',
      'code', 'missing_cabys',
      'message', 'Uno o mas productos no tienen CABYS configurado.'
    ));
  end if;

  v_issuer_snapshot := jsonb_build_object(
    'legalName', coalesce(v_settings.legal_name, v_config->>'razonSocial'),
    'identificationType', coalesce(v_settings.identification_type, v_config->>'tipoIdentificacion'),
    'identificationNumber', coalesce(v_settings.identification_number, v_config->>'identificacion'),
    'email', coalesce(v_settings.email, v_config->>'correoEmisor'),
    'activityCode', coalesce(v_settings.main_activity_code, v_config->>'actividadEconomica'),
    'branchCode', v_branch_code,
    'terminalCode', v_terminal_code
  );

  v_receiver_snapshot := jsonb_build_object(
    'name', v_customer.nombre,
    'identificationNumber', v_customer.identificacion,
    'email', v_customer.correo,
    'phone', coalesce(v_customer.telefono, v_customer.whatsapp)
  );

  insert into public.fiscal_documents (
    empresa_id,
    source_type,
    source_id,
    sale_id,
    customer_id,
    document_type_code,
    status,
    hacienda_status,
    environment,
    activity_code,
    branch_code,
    terminal_code,
    issue_datetime,
    currency_code,
    receiver_name,
    receiver_identification_type,
    receiver_identification_number,
    receiver_email,
    receiver_phone,
    issuer_snapshot,
    receiver_snapshot,
    totals,
    validation_errors,
    last_error,
    created_by
  )
  values (
    v_empresa_id,
    'sale',
    p_sale_id,
    v_sale.id,
    v_sale.cliente_id,
    p_document_type_code,
    case when jsonb_array_length(v_errors) = 0 then 'validated' else 'error_validation' end,
    'no_enviado',
    v_environment,
    coalesce(v_settings.main_activity_code, v_config->>'actividadEconomica'),
    v_branch_code,
    v_terminal_code,
    now(),
    coalesce(nullif(v_sale.moneda, ''), 'CRC'),
    v_customer.nombre,
    case when nullif(v_customer.identificacion, '') is not null then '02' else null end,
    v_customer.identificacion,
    v_customer.correo,
    coalesce(v_customer.telefono, v_customer.whatsapp),
    v_issuer_snapshot,
    v_receiver_snapshot,
    jsonb_build_object(
      'totalVenta', v_sale.subtotal + v_sale.descuento_total,
      'totalDescuentos', v_sale.descuento_total,
      'totalVentaNeta', v_sale.subtotal,
      'totalImpuestos', v_sale.impuesto_total,
      'totalComprobante', v_sale.total
    ),
    v_errors,
    case when jsonb_array_length(v_errors) = 0 then null else 'Documento fiscal preparado con errores de validacion.' end,
    v_user_id
  )
  returning * into v_document;

  if jsonb_array_length(v_errors) = 0 then
    insert into public.fiscal_document_lines (
      fiscal_document_id,
      empresa_id,
      line_number,
      source_item_id,
      product_id,
      cabys_code,
      commercial_code,
      quantity,
      unit_code,
      commercial_unit,
      detail,
      unit_price,
      gross_amount,
      discount_amount,
      subtotal,
      taxable_base,
      tax_amount,
      total_line_amount,
      is_good,
      is_service,
      is_exempt,
      is_non_subject
    )
    select
      v_document.id,
      v_empresa_id,
      row_number() over (order by vi.orden asc, vi.created_at asc)::integer,
      vi.id,
      vi.producto_id,
      fp.cabys_code,
      cp.codigo,
      vi.cantidad,
      coalesce(fp.fiscal_unit_code, 'Otros'),
      cp.unidad_medida,
      vi.descripcion,
      vi.precio_unitario,
      vi.cantidad * vi.precio_unitario,
      vi.descuento,
      vi.subtotal,
      case when coalesce(fp.is_tax_exempt, false) or coalesce(fp.is_non_subject, false) then null else vi.subtotal end,
      vi.impuesto_monto,
      vi.total,
      cp.tipo = 'producto',
      cp.tipo = 'servicio',
      coalesce(fp.is_tax_exempt, false),
      coalesce(fp.is_non_subject, false)
    from public.venta_items vi
    left join public.catalogo_productos cp
      on cp.id = vi.producto_id
     and cp.empresa_id = vi.empresa_id
    left join public.catalog_product_fiscal_profile fp
      on fp.empresa_id = vi.empresa_id
     and fp.product_id = vi.producto_id
    where vi.empresa_id = v_empresa_id
      and vi.venta_id = p_sale_id
    order by vi.orden asc, vi.created_at asc;

    insert into public.fiscal_document_line_taxes (
      fiscal_document_line_id,
      empresa_id,
      tax_code,
      tax_rate_code,
      rate,
      amount,
      taxable_base
    )
    select
      fdl.id,
      v_empresa_id,
      coalesce(fp.default_tax_code, '01'),
      fp.default_tax_rate_code,
      coalesce(fp.default_tax_rate, vi.impuesto_porcentaje),
      vi.impuesto_monto,
      fdl.taxable_base
    from public.fiscal_document_lines fdl
    join public.venta_items vi
      on vi.id = fdl.source_item_id
     and vi.empresa_id = fdl.empresa_id
    left join public.catalog_product_fiscal_profile fp
      on fp.empresa_id = vi.empresa_id
     and fp.product_id = vi.producto_id
    where fdl.fiscal_document_id = v_document.id
      and vi.impuesto_monto > 0;
  end if;

  insert into public.fiscal_document_events (
    fiscal_document_id,
    empresa_id,
    event_type,
    from_status,
    to_status,
    message,
    details,
    created_by
  )
  values (
    v_document.id,
    v_empresa_id,
    'prepared_from_sale',
    null,
    v_document.status,
    case when jsonb_array_length(v_errors) = 0 then 'Documento fiscal interno validado desde venta.' else 'Documento fiscal preparado con errores de validacion.' end,
    jsonb_build_object('saleId', p_sale_id, 'documentTypeCode', p_document_type_code),
    v_user_id
  );

  return query select v_document.id, v_document.status, v_document.validation_errors;
end;
$$;

revoke all on function public.billing_config_status_for_company(uuid) from public;
revoke all on function public.get_platform_billing_health(uuid) from public;
revoke all on function public.generate_fiscal_consecutivo(text, text, text, bigint) from public;
revoke all on function public.reserve_fiscal_sequence_for_current_company(text, text, text, text) from public;
revoke all on function public.prepare_fiscal_document_from_sale(uuid, text) from public;

grant execute on function public.billing_config_status_for_company(uuid) to authenticated;
grant execute on function public.get_platform_billing_health(uuid) to authenticated;
grant execute on function public.generate_fiscal_consecutivo(text, text, text, bigint) to authenticated;
grant execute on function public.reserve_fiscal_sequence_for_current_company(text, text, text, text) to authenticated;
grant execute on function public.prepare_fiscal_document_from_sale(uuid, text) to authenticated;
