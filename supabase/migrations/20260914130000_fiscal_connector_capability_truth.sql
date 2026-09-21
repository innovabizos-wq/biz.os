begin;

-- The catalog describes capabilities that Biz.OS can prove in the installed
-- adapter. Provider marketing claims are not executable capabilities.
update public.fiscal_connector_catalog
set capabilities = case code
  when 'gti' then '["connection_verified"]'::jsonb
  when 'factura_profesional' then '["connection_verified"]'::jsonb
  when 'alegra' then '["connection_verified","customers","products","taxes"]'::jsonb
  when 'hacienda' then '["issue_invoice","issue_ticket","status","artifacts","credit_note_schema","debit_note_schema"]'::jsonb
  when 'rest' then '["connection_verified"]'::jsonb
  when 'tico_factura_import' then '["import"]'::jsonb
  else capabilities
end,
updated_at = now()
where code in (
  'gti',
  'factura_profesional',
  'alegra',
  'hacienda',
  'rest',
  'tico_factura_import'
);

-- Earlier UI versions could mark a successful HTTP read as an active emission
-- contract. The worker only implements Hacienda direct today, so those rows
-- must remain verified until their adapter is installed and accepted.
update public.company_fiscal_connections
set status = 'verified',
    activated_at = null,
    last_error = 'Conexión verificada; contrato de emisión pendiente de instalar y aprobar.',
    updated_at = now()
where provider_code in ('gti', 'factura_profesional', 'alegra', 'rest')
  and status = 'active';

commit;
