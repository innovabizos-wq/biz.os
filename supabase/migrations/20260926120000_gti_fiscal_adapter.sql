begin;

-- GTI requests contain the canonical business document but never credentials.
-- They are archived before the external call so support can reconcile an
-- uncertain result without rebuilding or silently resubmitting the document.
alter table public.fiscal_document_artifacts
  drop constraint if exists fiscal_document_artifacts_type_check;

alter table public.fiscal_document_artifacts
  add constraint fiscal_document_artifacts_type_check check (artifact_type in (
    'xml_unsigned',
    'xml_signed',
    'hacienda_response',
    'provider_request',
    'provider_response',
    'pdf_representation',
    'pdf'
  ));

update public.fiscal_connector_catalog
set capabilities = '["endpoint_reachable","payload_v44","issue_invoice","issue_ticket","artifacts","duplicate_guard"]'::jsonb,
    updated_at = now()
where code = 'gti';

-- Existing GTI connections stay non-active until a real sandbox emission and
-- recoverable status query prove the provider-specific contract.
update public.company_fiscal_connections
set status = 'verified',
    activated_at = null,
    last_error = 'Adaptador GTI instalado; homologación sandbox y consulta recuperable pendientes.',
    updated_at = now()
where provider_code = 'gti'
  and status = 'active';

commit;
