-- Secure, tenant-scoped XML import history for supplier documents and exports
-- originating in external invoicing systems such as Tico Factura.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.fiscal_xml_import_batches (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  import_source text not null,
  document_direction text not null,
  source_name text,
  xml_sha256 text not null,
  status text not null default 'previewed',
  document_root text,
  document_type_code text,
  clave text,
  consecutivo text,
  issuer_name text,
  issuer_identification text,
  receiver_name text,
  receiver_identification text,
  issue_datetime timestamptz,
  total_amount numeric(14, 4),
  currency_code text,
  xsd_valid boolean not null default false,
  xsd_errors jsonb not null default '[]'::jsonb,
  validation_errors jsonb not null default '[]'::jsonb,
  duplicate_document_id uuid,
  suggested_sale_id uuid,
  imported_document_id uuid,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fiscal_xml_import_batches_id_empresa_unique unique (id, empresa_id),
  constraint fiscal_xml_import_batches_source_check
    check (import_source in ('manual_xml', 'tico_factura', 'rest_import', 'other')),
  constraint fiscal_xml_import_batches_direction_check
    check (document_direction in ('incoming', 'outgoing')),
  constraint fiscal_xml_import_batches_status_check
    check (status in ('previewed', 'processing', 'imported', 'duplicate', 'rejected')),
  constraint fiscal_xml_import_batches_hash_check check (xml_sha256 ~ '^[0-9a-f]{64}$'),
  constraint fiscal_xml_import_batches_xsd_errors_array_check
    check (jsonb_typeof(xsd_errors) = 'array'),
  constraint fiscal_xml_import_batches_validation_errors_array_check
    check (jsonb_typeof(validation_errors) = 'array'),
  constraint fiscal_xml_import_batches_sale_empresa_fkey
    foreign key (suggested_sale_id, empresa_id)
    references public.ventas(id, empresa_id)
    on delete set null (suggested_sale_id)
);

alter table public.fiscal_received_documents
  add column if not exists document_direction text not null default 'incoming',
  add column if not exists import_source text not null default 'manual_xml',
  add column if not exists source_name text,
  add column if not exists xml_sha256 text,
  add column if not exists import_batch_id uuid,
  add column if not exists linked_sale_id uuid,
  add column if not exists receiver_name text,
  add column if not exists receiver_identification text,
  add column if not exists document_root text,
  add column if not exists document_type_code text,
  add column if not exists xsd_valid boolean,
  add column if not exists hacienda_status_verified boolean not null default false;

alter table public.fiscal_received_documents
  drop constraint if exists fiscal_received_documents_response_status_check;
alter table public.fiscal_received_documents
  add constraint fiscal_received_documents_response_status_check
  check (receiver_response_status in (
    'pending', 'accepted', 'partially_accepted', 'rejected', 'sent', 'error', 'not_applicable'
  ));

update public.fiscal_received_documents
set xml_sha256 = parsed_data ->> 'sha256'
where xml_sha256 is null
  and coalesce(parsed_data ->> 'sha256', '') ~ '^[0-9a-f]{64}$';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.fiscal_received_documents'::regclass
      and conname = 'fiscal_received_documents_id_empresa_unique'
  ) then
    alter table public.fiscal_received_documents
      add constraint fiscal_received_documents_id_empresa_unique unique (id, empresa_id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.fiscal_received_documents'::regclass
      and conname = 'fiscal_received_documents_direction_check'
  ) then
    alter table public.fiscal_received_documents
      add constraint fiscal_received_documents_direction_check
      check (document_direction in ('incoming', 'outgoing'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.fiscal_received_documents'::regclass
      and conname = 'fiscal_received_documents_import_source_check'
  ) then
    alter table public.fiscal_received_documents
      add constraint fiscal_received_documents_import_source_check
      check (import_source in ('manual_xml', 'tico_factura', 'rest_import', 'other'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.fiscal_received_documents'::regclass
      and conname = 'fiscal_received_documents_xml_hash_check'
  ) then
    alter table public.fiscal_received_documents
      add constraint fiscal_received_documents_xml_hash_check
      check (xml_sha256 is null or xml_sha256 ~ '^[0-9a-f]{64}$');
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.fiscal_received_documents'::regclass
      and conname = 'fiscal_received_documents_import_batch_empresa_fkey'
  ) then
    alter table public.fiscal_received_documents
      add constraint fiscal_received_documents_import_batch_empresa_fkey
      foreign key (import_batch_id, empresa_id)
      references public.fiscal_xml_import_batches(id, empresa_id)
      on delete set null (import_batch_id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.fiscal_received_documents'::regclass
      and conname = 'fiscal_received_documents_linked_sale_empresa_fkey'
  ) then
    alter table public.fiscal_received_documents
      add constraint fiscal_received_documents_linked_sale_empresa_fkey
      foreign key (linked_sale_id, empresa_id)
      references public.ventas(id, empresa_id)
      on delete set null (linked_sale_id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.fiscal_xml_import_batches'::regclass
      and conname = 'fiscal_xml_import_batches_duplicate_empresa_fkey'
  ) then
    alter table public.fiscal_xml_import_batches
      add constraint fiscal_xml_import_batches_duplicate_empresa_fkey
      foreign key (duplicate_document_id, empresa_id)
      references public.fiscal_received_documents(id, empresa_id)
      on delete set null (duplicate_document_id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.fiscal_xml_import_batches'::regclass
      and conname = 'fiscal_xml_import_batches_imported_empresa_fkey'
  ) then
    alter table public.fiscal_xml_import_batches
      add constraint fiscal_xml_import_batches_imported_empresa_fkey
      foreign key (imported_document_id, empresa_id)
      references public.fiscal_received_documents(id, empresa_id)
      on delete set null (imported_document_id);
  end if;
end $$;

drop index if exists public.fiscal_received_documents_empresa_xml_sha256_unique;
create unique index fiscal_received_documents_empresa_xml_sha256_unique
  on public.fiscal_received_documents (empresa_id, xml_sha256)
  where xml_sha256 is not null;

create index if not exists fiscal_xml_import_batches_empresa_created_idx
  on public.fiscal_xml_import_batches (empresa_id, created_at desc);
create index if not exists fiscal_received_documents_direction_created_idx
  on public.fiscal_received_documents (empresa_id, document_direction, created_at desc);
create index if not exists fiscal_received_documents_linked_sale_idx
  on public.fiscal_received_documents (empresa_id, linked_sale_id)
  where linked_sale_id is not null;

drop trigger if exists set_fiscal_xml_import_batches_updated_at on public.fiscal_xml_import_batches;
create trigger set_fiscal_xml_import_batches_updated_at
before update on public.fiscal_xml_import_batches
for each row execute function public.set_updated_at();

alter table public.fiscal_xml_import_batches enable row level security;

revoke insert, update, delete on public.fiscal_xml_import_batches from authenticated;
grant select on public.fiscal_xml_import_batches to authenticated;

drop policy if exists fiscal_xml_import_batches_select_company on public.fiscal_xml_import_batches;
create policy fiscal_xml_import_batches_select_company
on public.fiscal_xml_import_batches for select to authenticated
using (
  empresa_id = (select public.current_empresa_id())
  and (
    (select public.current_user_has_permission('billing.view'))
    or (select public.current_user_has_permission('billing.issue'))
    or (select public.current_user_has_permission('billing.invoices.view'))
    or (select public.current_user_has_permission('billing.invoices.create'))
    or (select public.current_user_has_permission('billing.receive'))
  )
);

drop policy if exists fiscal_xml_import_batches_write_company on public.fiscal_xml_import_batches;
create policy fiscal_xml_import_batches_write_company
on public.fiscal_xml_import_batches for all to authenticated
using (
  empresa_id = (select public.current_empresa_id())
  and (
    (select public.current_user_has_permission('billing.issue'))
    or (select public.current_user_has_permission('billing.invoices.create'))
    or (select public.current_user_has_permission('billing.receive'))
  )
)
with check (
  empresa_id = (select public.current_empresa_id())
  and (
    (select public.current_user_has_permission('billing.issue'))
    or (select public.current_user_has_permission('billing.invoices.create'))
    or (select public.current_user_has_permission('billing.receive'))
  )
);

drop function if exists public.import_fiscal_external_xml(
  uuid, text, text, text, text, text, jsonb, jsonb, jsonb, uuid, uuid
);

create or replace function public.import_fiscal_external_xml(
  p_empresa_id uuid,
  p_actor_id uuid,
  p_import_source text,
  p_document_direction text,
  p_source_name text,
  p_xml_sha256 text,
  p_xml_content text,
  p_document jsonb,
  p_validation_errors jsonb,
  p_xsd_errors jsonb,
  p_linked_sale_id uuid default null,
  p_suggested_sale_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := p_actor_id;
  v_batch_id uuid;
  v_document_id uuid;
  v_existing_document_id uuid;
  v_linked_sale public.ventas%rowtype;
  v_expected_hash text;
  v_storage_path text;
begin
  if v_user_id is null or not exists (
    select 1
    from public.profiles as p
    join public.rol_permisos as rp
      on rp.empresa_id = p.empresa_id and rp.rol_id = p.rol_id
    join public.permisos as permission on permission.id = rp.permiso_id
    where p.id = v_user_id
      and p.empresa_id = p_empresa_id
      and p.estado = 'activo'
      and permission.estado = 'activo'
      and permission.codigo in ('billing.issue', 'billing.invoices.create', 'billing.receive')
  ) then
    raise exception 'No tienes permiso para importar XML fiscal.';
  end if;
  if p_import_source not in ('manual_xml', 'tico_factura', 'rest_import', 'other') then
    raise exception 'Origen de importacion no admitido.';
  end if;
  if p_document_direction not in ('incoming', 'outgoing') then
    raise exception 'Direccion fiscal no admitida.';
  end if;
  if jsonb_typeof(p_validation_errors) <> 'array'
    or jsonb_array_length(p_validation_errors) > 0
    or jsonb_typeof(p_xsd_errors) <> 'array'
    or jsonb_array_length(p_xsd_errors) > 0 then
    raise exception 'El XML debe superar todas las validaciones antes de importarse.';
  end if;
  if octet_length(p_xml_content) = 0 or octet_length(p_xml_content) > 2000000 then
    raise exception 'El XML esta vacio o supera 2 MB.';
  end if;
  if p_xml_content ~* '<!DOCTYPE|<!ENTITY' then
    raise exception 'El XML contiene declaraciones no permitidas.';
  end if;

  v_expected_hash := encode(extensions.digest(convert_to(p_xml_content, 'UTF8'), 'sha256'), 'hex');
  if p_xml_sha256 !~ '^[0-9a-f]{64}$' or p_xml_sha256 <> v_expected_hash then
    raise exception 'La huella del XML no coincide con su contenido.';
  end if;

  if p_document_direction = 'incoming' and p_linked_sale_id is not null then
    raise exception 'Un documento entrante no se vincula con una venta.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_empresa_id::text || ':hash:' || p_xml_sha256, 0)
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      p_empresa_id::text || ':clave:' || coalesce(p_document ->> 'clave', p_xml_sha256),
      0
    )
  );

  if p_linked_sale_id is not null then
    select * into v_linked_sale
    from public.ventas
    where id = p_linked_sale_id and empresa_id = p_empresa_id
    for share;

    if not found then
      raise exception 'La venta seleccionada no pertenece a esta empresa.';
    end if;
    if v_linked_sale.moneda is distinct from (p_document ->> 'currencyCode')
      or abs(v_linked_sale.total - ((p_document ->> 'totalAmount')::numeric)) > 0.01 then
      raise exception 'La moneda o el total del XML no coincide con la venta seleccionada.';
    end if;
  end if;

  insert into public.fiscal_xml_import_batches (
    empresa_id, import_source, document_direction, source_name, xml_sha256, status,
    document_root, document_type_code, clave, consecutivo, issuer_name,
    issuer_identification, receiver_name, receiver_identification, issue_datetime,
    total_amount, currency_code, xsd_valid, xsd_errors, validation_errors,
    suggested_sale_id, created_by
  ) values (
    p_empresa_id, p_import_source, p_document_direction, nullif(trim(p_source_name), ''),
    p_xml_sha256, 'processing', p_document ->> 'documentRoot',
    p_document ->> 'documentTypeCode', p_document ->> 'clave', p_document ->> 'consecutivo',
    p_document ->> 'issuerName', p_document ->> 'issuerIdentification',
    p_document ->> 'receiverName', p_document ->> 'receiverIdentification',
    (p_document ->> 'issueDatetime')::timestamptz,
    (p_document ->> 'totalAmount')::numeric, p_document ->> 'currencyCode', true,
    p_xsd_errors, p_validation_errors, p_suggested_sale_id, v_user_id
  ) returning id into v_batch_id;

  select id into v_existing_document_id
  from public.fiscal_received_documents
  where empresa_id = p_empresa_id
    and (
      xml_sha256 = p_xml_sha256
      or (p_document ->> 'clave') is not null and clave = p_document ->> 'clave'
    )
  order by created_at
  limit 1;

  if v_existing_document_id is not null then
    update public.fiscal_xml_import_batches
    set status = 'duplicate', duplicate_document_id = v_existing_document_id
    where id = v_batch_id;
    return jsonb_build_object(
      'batchId', v_batch_id,
      'documentId', v_existing_document_id,
      'status', 'duplicate'
    );
  end if;

  v_storage_path := concat(
    'billing/', p_empresa_id, '/external-documents/',
    coalesce(p_document ->> 'clave', p_xml_sha256), '/original.xml'
  );

  insert into public.fiscal_received_documents (
    empresa_id, clave, consecutivo, issuer_name, issuer_identification,
    receiver_name, receiver_identification, issue_datetime, total_amount, currency_code,
    hacienda_status, hacienda_status_verified, receiver_response_status, xml_storage_path,
    xml_sha256, import_batch_id, import_source, source_name, document_direction,
    document_root, document_type_code, xsd_valid, linked_sale_id, parsed_data,
    validation_errors, created_by
  ) values (
    p_empresa_id, p_document ->> 'clave', p_document ->> 'consecutivo',
    p_document ->> 'issuerName', p_document ->> 'issuerIdentification',
    p_document ->> 'receiverName', p_document ->> 'receiverIdentification',
    (p_document ->> 'issueDatetime')::timestamptz,
    (p_document ->> 'totalAmount')::numeric, p_document ->> 'currencyCode',
    null, false, case when p_document_direction = 'incoming' then 'pending' else 'not_applicable' end,
    v_storage_path, p_xml_sha256, v_batch_id, p_import_source, nullif(trim(p_source_name), ''),
    p_document_direction, p_document ->> 'documentRoot', p_document ->> 'documentTypeCode',
    true, p_linked_sale_id,
    coalesce(p_document -> 'parsedData', '{}'::jsonb) || jsonb_build_object(
      'sha256', p_xml_sha256,
      'xmlStoragePath', v_storage_path,
      'importBatchId', v_batch_id,
      'haciendaStatusVerified', false
    ),
    '[]'::jsonb, v_user_id
  ) returning id into v_document_id;

  insert into public.fiscal_received_document_artifacts (
    empresa_id, fiscal_received_document_id, artifact_type, storage_path,
    content_text, content_mime_type, sha256, status, metadata, created_by
  ) values (
    p_empresa_id, v_document_id, 'xml_received', v_storage_path,
    p_xml_content, 'application/xml', p_xml_sha256, 'stored',
    jsonb_build_object(
      'importedAt', now(),
      'importedBy', 'import_fiscal_external_xml',
      'importBatchId', v_batch_id,
      'source', p_import_source,
      'direction', p_document_direction,
      'xsdVersion', '4.4',
      'pendingReceiverMessage', p_document_direction = 'incoming',
      'haciendaStatusVerified', false
    ),
    v_user_id
  );

  update public.fiscal_xml_import_batches
  set status = 'imported', imported_document_id = v_document_id
  where id = v_batch_id;

  return jsonb_build_object(
    'batchId', v_batch_id,
    'documentId', v_document_id,
    'status', 'imported'
  );
end;
$$;

revoke all on function public.import_fiscal_external_xml(
  uuid, uuid, text, text, text, text, text, jsonb, jsonb, jsonb, uuid, uuid
) from public, anon, authenticated;
grant execute on function public.import_fiscal_external_xml(
  uuid, uuid, text, text, text, text, text, jsonb, jsonb, jsonb, uuid, uuid
) to service_role;

comment on table public.fiscal_xml_import_batches is
  'Auditable preview/import history for fiscal XML received from external systems.';
comment on column public.fiscal_received_documents.hacienda_status_verified is
  'False until an official Hacienda response or query proves the imported document status.';
comment on function public.import_fiscal_external_xml is
  'Atomically deduplicates and archives one validated external fiscal XML and its import batch.';
