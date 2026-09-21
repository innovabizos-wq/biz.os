-- Remove output-column ambiguity from supplier-credit conflict handling.

create or replace function public.settle_purchase_return_financial(
  p_operation_id uuid,
  p_return_id uuid,
  p_supplier_document_reference text default null
)
returns table (
  return_id uuid,
  account_id uuid,
  account_total numeric,
  account_balance numeric,
  supplier_credit numeric,
  replayed boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_empresa_id uuid := public.current_empresa_id();
  v_return public.purchase_returns%rowtype;
  v_account public.payments_accounts%rowtype;
  v_paid numeric(14, 2);
  v_new_total numeric(14, 2);
  v_new_balance numeric(14, 2);
  v_supplier_credit numeric(14, 2);
  v_reference text := nullif(btrim(coalesce(p_supplier_document_reference, '')), '');
  v_new_status text;
begin
  if v_user_id is null or v_empresa_id is null then
    raise exception 'Usuario autenticado requerido.' using errcode = '28000';
  end if;

  if not public.current_user_has_permission('purchases.orders.manage')
     or not public.current_user_has_permission('payments.accounts.manage') then
    raise exception 'Permisos de compras y pagos requeridos.' using errcode = '42501';
  end if;

  if p_operation_id is null then
    raise exception 'Identificador idempotente requerido.' using errcode = '22023';
  end if;

  if length(coalesce(v_reference, '')) > 160 then
    raise exception 'La referencia no puede superar 160 caracteres.' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      v_empresa_id::text || ':purchase.return.financial:' || p_operation_id::text,
      0
    )
  );

  select pr.* into v_return
  from public.purchase_returns as pr
  where pr.id = p_return_id
    and pr.empresa_id = v_empresa_id
  for update;

  if v_return.id is null then
    raise exception 'Devolucion de compra no encontrada.' using errcode = '02000';
  end if;

  if v_return.financial_status = 'processed' then
    if v_return.financial_operation_id <> p_operation_id
       or coalesce(v_return.supplier_document_reference, '') <> coalesce(v_reference, '') then
      raise exception 'La devolucion financiera ya fue procesada con otra operacion.'
        using errcode = '23505';
    end if;

    select pa.* into v_account
    from public.payments_accounts as pa
    where pa.id = v_return.financial_account_id
      and pa.empresa_id = v_empresa_id;

    return query select
      v_return.id,
      v_return.financial_account_id,
      v_account.total,
      v_account.saldo,
      v_return.supplier_credit_amount,
      true;
    return;
  end if;

  if v_return.financial_status <> 'pending'
     or v_return.status <> 'confirmed'
     or v_return.total_amount <= 0 then
    raise exception 'La devolucion no admite ajuste financiero.' using errcode = '22023';
  end if;

  select pa.* into v_account
  from public.payments_accounts as pa
  where pa.empresa_id = v_empresa_id
    and pa.compra_id = v_return.order_id
    and pa.tipo = 'payable'
  for update;

  if v_account.id is null then
    raise exception 'La compra no tiene una cuenta por pagar sincronizada.' using errcode = '02000';
  end if;

  select coalesce(sum(pt.monto), 0) into v_paid
  from public.payments_transactions as pt
  where pt.empresa_id = v_empresa_id
    and pt.account_id = v_account.id;

  v_new_total := greatest(v_account.total - v_return.total_amount, 0);
  v_new_balance := greatest(v_new_total - v_paid, 0);
  v_supplier_credit := greatest(v_paid - v_new_total, 0);
  v_new_status := case
    when v_new_balance = 0 then 'pagada'
    when v_paid > 0 then 'parcial'
    when v_account.fecha_vencimiento is not null
      and v_account.fecha_vencimiento < current_date then 'vencida'
    else 'pendiente'
  end;

  update public.payments_accounts as pa
  set
    total = v_new_total,
    saldo = v_new_balance,
    estado = v_new_status,
    updated_by = v_user_id
  where pa.id = v_account.id
    and pa.empresa_id = v_empresa_id
  returning * into v_account;

  if v_supplier_credit > 0 then
    insert into public.purchase_supplier_credits (
      empresa_id,
      supplier_id,
      order_id,
      return_id,
      amount,
      currency_code,
      reference,
      created_by
    )
    values (
      v_empresa_id,
      v_return.supplier_id,
      v_return.order_id,
      v_return.id,
      v_supplier_credit,
      v_return.currency_code,
      v_reference,
      v_user_id
    )
    on conflict on constraint purchase_supplier_credits_return_unique do nothing;
  end if;

  update public.purchase_returns as pr
  set
    financial_status = 'processed',
    financial_operation_id = p_operation_id,
    financial_account_id = v_account.id,
    financial_processed_by = v_user_id,
    financial_processed_at = now(),
    supplier_credit_amount = v_supplier_credit,
    supplier_document_reference = v_reference
  where pr.id = v_return.id
    and pr.empresa_id = v_empresa_id
  returning * into v_return;

  return query select
    v_return.id,
    v_account.id,
    v_account.total,
    v_account.saldo,
    v_supplier_credit,
    false;
end;
$$;

revoke all on function public.settle_purchase_return_financial(uuid, uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.settle_purchase_return_financial(uuid, uuid, text)
  to authenticated;

comment on function public.settle_purchase_return_financial(uuid, uuid, text)
  is 'Reduces the payable once and records any supplier credit caused by prior payment.';