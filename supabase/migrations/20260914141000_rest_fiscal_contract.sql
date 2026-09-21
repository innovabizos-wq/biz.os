begin;

update public.fiscal_connector_catalog
set capabilities = '["issue_invoice","status","artifacts","idempotency"]'::jsonb,
    updated_at = now()
where code = 'rest';

-- Store provider-neutral responses separately from official Hacienda messages.
alter table public.fiscal_document_artifacts
  drop constraint if exists fiscal_document_artifacts_type_check;

alter table public.fiscal_document_artifacts
  add constraint fiscal_document_artifacts_type_check check (artifact_type in (
    'xml_unsigned',
    'xml_signed',
    'hacienda_response',
    'provider_response',
    'pdf_representation',
    'pdf'
  ));

commit;
