-- Idempotent payment recording shared by the UI and Business Brain.
-- The original result is persisted so a retry never reports a later account balance.

alter table public.payments_transactions
  add column if not exists operation_id uuid,
  add column if not exists resulting_balance numeric(14, 2),
  add column if not exists resulting_account_status text;

alter table public.payments_transactions
  drop constraint if exists payments_transactions_resulting_balance_check;

alter table public.payments_transactions
  add constraint payments_transactions_resulting_balance_check
  check (resulting_balance is null or resulting_balance >= 0);

alter table public.payments_transactions
  drop constraint if exists payments_transactions_resulting_account_status_check;

alter table public.payments_transactions
  add constraint payments_transactions_resulting_account_status_check
  check (
    resulting_account_status is null
    or resulting_account_status in ('pendiente', 'parcial', 'pagada', 'vencida', 'anulada')
  );

alter table public.payments_transactions
  drop constraint if exists payments_transactions_operation_result_check;

alter table public.payments_transactions
  add constraint payments_transactions_operation_result_check
  check (
    operation_id is null
    or (resulting_balance is not null and resulting_account_status is not null)
  );

create unique index if not exists payments_transactions_empresa_operation_unique
  on public.payments_transactions (empresa_id, operation_id)
  where operation_id is not null;

create or replace function public.registrar_movimiento_cuenta_idempotente(
  p_operation_id uuid,
  p_account_id uuid,
  p_monto numeric,
  p_metodo text default 'cash',
  p_referencia text default null,
  p_notas text default null
)
returns table (
  transaction_id uuid,
  account_id uuid,
  saldo numeric,
  estado text,
  replayed boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_empresa_id uuid := public.current_empresa_id();
  v_account public.payments_accounts%rowtype;
  v_existing public.payments_transactions%rowtype;
  v_transaction_id uuid;
  v_amount numeric(14, 2);
  v_method text := lower(btrim(coalesce(p_metodo, '')));
  v_reference text := nullif(btrim(coalesce(p_referencia, '')), '');
  v_notes text := nullif(btrim(coalesce(p_notas, '')), '');
  v_new_balance numeric(14, 2);
  v_new_status text;
begin
  if v_user_id is null or v_empresa_id is null then
    raise exception 'Usuario autenticado requerido.' using errcode = '28000';
  end if;

  if not public.current_user_has_permission('payments.accounts.manage') then
    raise exception 'Permiso payments.accounts.manage requerido.' using errcode = '42501';
  end if;

  if p_operation_id is null then
    raise exception 'Identificador idempotente requerido.' using errcode = '22023';
  end if;

  if p_account_id is null then
    raise exception 'Cuenta requerida.' using errcode = '22023';
  end if;

  if p_monto is null
     or p_monto <= 0
     or p_monto > 999999999999.99
     or p_monto <> round(p_monto, 2) then
    raise exception 'Monto invalido; use un valor positivo con maximo dos decimales.'
      using errcode = '22023';
  end if;

  if v_method not in ('cash', 'card', 'sinpe', 'transfer', 'other') then
    raise exception 'Metodo de pago no permitido.' using errcode = '22023';
  end if;

  if v_method in ('card', 'sinpe', 'transfer') and v_reference is null then
    raise exception 'La referencia es requerida para tarjeta, SINPE o transferencia.'
      using errcode = '22023';
  end if;

  if length(coalesce(v_reference, '')) > 160 then
    raise exception 'La referencia no puede superar 160 caracteres.' using errcode = '22023';
  end if;

  if length(coalesce(v_notes, '')) > 1000 then
    raise exception 'Las notas no pueden superar 1000 caracteres.' using errcode = '22023';
  end if;

  v_amount := p_monto;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      v_empresa_id::text || ':payment.record:' || p_operation_id::text,
      0
    )
  );

  select t.*
  into v_existing
  from public.payments_transactions as t
  where t.empresa_id = v_empresa_id
    and t.operation_id = p_operation_id;

  if v_existing.id is not null then
    if v_existing.account_id <> p_account_id
       or v_existing.tipo <> 'payment'
       or v_existing.monto <> v_amount
       or lower(btrim(v_existing.metodo)) <> v_method
       or coalesce(v_existing.referencia, '') <> coalesce(v_reference, '')
       or coalesce(v_existing.notas, '') <> coalesce(v_notes, '') then
      raise exception 'La clave idempotente ya fue usada con otros datos.'
        using errcode = '23505';
    end if;

    return query
    select
      v_existing.id,
      v_existing.account_id,
      v_existing.resulting_balance,
      v_existing.resulting_account_status,
      true;
    return;
  end if;

  select account.*
  into v_account
  from public.payments_accounts as account
  where account.id = p_account_id
    and account.empresa_id = v_empresa_id
  for update;

  if v_account.id is null then
    raise exception 'Cuenta no encontrada.' using errcode = '02000';
  end if;

  if v_account.estado in ('pagada', 'anulada') then
    raise exception 'La cuenta no acepta nuevos movimientos.' using errcode = '22023';
  end if;

  if v_amount > v_account.saldo then
    raise exception 'El monto no puede superar el saldo pendiente.' using errcode = '22023';
  end if;

  v_new_balance := v_account.saldo - v_amount;
  v_new_status := case when v_new_balance = 0 then 'pagada' else 'parcial' end;

  insert into public.payments_transactions (
    empresa_id,
    account_id,
    tipo,
    monto,
    metodo,
    referencia,
    notas,
    created_by,
    operation_id,
    resulting_balance,
    resulting_account_status
  )
  values (
    v_empresa_id,
    p_account_id,
    'payment',
    v_amount,
    v_method,
    v_reference,
    v_notes,
    v_user_id,
    p_operation_id,
    v_new_balance,
    v_new_status
  )
  returning id into v_transaction_id;

  update public.payments_accounts as account
  set
    saldo = v_new_balance,
    estado = v_new_status,
    updated_by = v_user_id
  where account.id = p_account_id
    and account.empresa_id = v_empresa_id;

  return query
  select v_transaction_id, p_account_id, v_new_balance, v_new_status, false;
end;
$$;

revoke all on function public.registrar_movimiento_cuenta_idempotente(
  uuid,
  uuid,
  numeric,
  text,
  text,
  text
) from public, anon, authenticated;

grant execute on function public.registrar_movimiento_cuenta_idempotente(
  uuid,
  uuid,
  numeric,
  text,
  text,
  text
) to authenticated;

comment on function public.registrar_movimiento_cuenta_idempotente(
  uuid,
  uuid,
  numeric,
  text,
  text,
  text
) is 'Records a payment exactly once per tenant operation id and replays its original result.';
