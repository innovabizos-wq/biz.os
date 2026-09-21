begin;

alter table public.company_fiscal_settings
  add column if not exists software_provider_identification text;

alter table public.crm_clientes
  add column if not exists fiscal_identification_type text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'company_fiscal_settings_provider_identification_check'
      and conrelid = 'public.company_fiscal_settings'::regclass
  ) then
    alter table public.company_fiscal_settings
      add constraint company_fiscal_settings_provider_identification_check
      check (
        software_provider_identification is null
        or char_length(btrim(software_provider_identification)) between 1 and 20
      ) not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'company_fiscal_settings_location_codes_check'
      and conrelid = 'public.company_fiscal_settings'::regclass
  ) then
    alter table public.company_fiscal_settings
      add constraint company_fiscal_settings_location_codes_check
      check (
        (province_code is null or province_code ~ '^[1-7]$')
        and (canton_code is null or canton_code ~ '^[0-9]{2}$')
        and (district_code is null or district_code ~ '^[0-9]{2}$')
        and (neighborhood is null or char_length(btrim(neighborhood)) between 5 and 50)
        and (address_line is null or char_length(btrim(address_line)) between 5 and 250)
      ) not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'crm_clientes_fiscal_identification_type_check'
      and conrelid = 'public.crm_clientes'::regclass
  ) then
    alter table public.crm_clientes
      add constraint crm_clientes_fiscal_identification_type_check
      check (
        fiscal_identification_type is null
        or fiscal_identification_type in ('01', '02', '03', '04')
      ) not valid;
  end if;
end $$;

create or replace function public.enrich_new_fiscal_document_v44()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_settings public.company_fiscal_settings%rowtype;
  v_customer public.crm_clientes%rowtype;
  v_errors jsonb := coalesce(new.validation_errors, '[]'::jsonb);
  v_address jsonb;
begin
  select settings.*
  into v_settings
  from public.company_fiscal_settings as settings
  where settings.empresa_id = new.empresa_id;

  if new.customer_id is not null then
    select customer.*
    into v_customer
    from public.crm_clientes as customer
    where customer.id = new.customer_id
      and customer.empresa_id = new.empresa_id;
  end if;

  v_address := jsonb_strip_nulls(jsonb_build_object(
    'provinceCode', nullif(btrim(v_settings.province_code), ''),
    'cantonCode', nullif(btrim(v_settings.canton_code), ''),
    'districtCode', nullif(btrim(v_settings.district_code), ''),
    'neighborhood', nullif(btrim(v_settings.neighborhood), ''),
    'addressLine', nullif(btrim(v_settings.address_line), '')
  ));

  new.issuer_snapshot := coalesce(new.issuer_snapshot, '{}'::jsonb) || jsonb_strip_nulls(
    jsonb_build_object(
      'softwareProviderIdentification', nullif(btrim(v_settings.software_provider_identification), ''),
      'address', v_address,
      'defaultSaleConditionCode', coalesce(v_settings.default_sale_condition_code, '01'),
      'defaultPaymentMethodCode', coalesce(v_settings.default_payment_method_code, '01')
    )
  );

  new.sale_condition_code := coalesce(
    new.sale_condition_code,
    v_settings.default_sale_condition_code,
    '01'
  );
  if new.currency_code = 'CRC' then
    new.exchange_rate := coalesce(new.exchange_rate, 1);
  end if;

  if v_customer.id is not null then
    new.receiver_identification_type := v_customer.fiscal_identification_type;
    new.receiver_snapshot := coalesce(new.receiver_snapshot, '{}'::jsonb) || jsonb_strip_nulls(
      jsonb_build_object('identificationType', v_customer.fiscal_identification_type)
    );
  end if;

  if nullif(btrim(v_settings.software_provider_identification), '') is null then
    v_errors := v_errors || jsonb_build_array(jsonb_build_object(
      'group', 'Empresa',
      'code', 'missing_software_provider_identification',
      'message', 'Falta la identificacion del proveedor del sistema exigida por XML 4.4.'
    ));
  end if;

  if nullif(btrim(v_settings.province_code), '') is null
     or nullif(btrim(v_settings.canton_code), '') is null
     or nullif(btrim(v_settings.district_code), '') is null
     or nullif(btrim(v_settings.address_line), '') is null then
    v_errors := v_errors || jsonb_build_array(jsonb_build_object(
      'group', 'Empresa',
      'code', 'missing_issuer_address',
      'message', 'Falta completar provincia, canton, distrito y otras senas del emisor.'
    ));
  end if;

  if new.document_type_code = '01'
     and (nullif(btrim(new.receiver_identification_number), '') is null
          or nullif(btrim(new.receiver_identification_type), '') is null) then
    v_errors := v_errors || jsonb_build_array(jsonb_build_object(
      'group', 'Cliente',
      'code', 'missing_receiver_identification_type',
      'message', 'La factura requiere numero y tipo de identificacion fiscal del receptor.'
    ));
  end if;

  new.validation_errors := v_errors;
  if jsonb_array_length(v_errors) > 0 and new.status in ('draft', 'validated') then
    new.status := 'error_validation';
    new.last_error := 'Documento fiscal preparado con errores de validacion.';
  end if;

  return new;
end;
$$;

revoke all on function public.enrich_new_fiscal_document_v44() from public;
revoke all on function public.enrich_new_fiscal_document_v44() from anon;
revoke all on function public.enrich_new_fiscal_document_v44() from authenticated;

drop trigger if exists enrich_new_fiscal_document_v44 on public.fiscal_documents;
create trigger enrich_new_fiscal_document_v44
before insert on public.fiscal_documents
for each row execute function public.enrich_new_fiscal_document_v44();

create or replace function public.set_crm_customer_fiscal_identification_type(
  p_customer_id uuid,
  p_fiscal_identification_type text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company_id uuid := public.current_empresa_id();
begin
  if auth.uid() is null or v_company_id is null then
    raise exception 'Usuario autenticado requerido.' using errcode = '28000';
  end if;

  if not (
    public.current_user_has_permission('crm.customers.create')
    or public.current_user_has_permission('crm.customers.edit')
  ) then
    raise exception 'Permiso de clientes requerido.' using errcode = '42501';
  end if;

  if p_fiscal_identification_type is not null
     and p_fiscal_identification_type not in ('01', '02', '03', '04') then
    raise exception 'Tipo de identificacion fiscal invalido.' using errcode = '22023';
  end if;

  update public.crm_clientes
  set fiscal_identification_type = p_fiscal_identification_type,
      updated_at = now()
  where id = p_customer_id
    and empresa_id = v_company_id;

  if not found then
    raise exception 'Cliente no encontrado.' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.set_crm_customer_fiscal_identification_type(uuid, text) from public;
revoke all on function public.set_crm_customer_fiscal_identification_type(uuid, text) from anon;
grant execute on function public.set_crm_customer_fiscal_identification_type(uuid, text) to authenticated;

commit;
