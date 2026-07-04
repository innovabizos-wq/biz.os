-- Cierre MVP: evitar sobrepagos silenciosos en CxC/CxP.
-- No cambia tablas ni datos; solo endurece el contrato del RPC existente.

create or replace function public.registrar_movimiento_cuenta(
  p_account_id uuid,
  p_monto numeric,
  p_metodo text default 'manual',
  p_referencia text default null,
  p_notas text default null
)
returns table (
  account_id uuid,
  saldo numeric,
  estado text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_empresa_id uuid := public.current_empresa_id();
  v_account public.payments_accounts%rowtype;
  v_amount numeric(14, 2);
  v_new_saldo numeric(14, 2);
begin
  if v_user_id is null or v_empresa_id is null then
    raise exception 'Usuario autenticado requerido.' using errcode = '28000';
  end if;

  if not public.current_user_has_permission('payments.accounts.manage') then
    raise exception 'Permiso payments.accounts.manage requerido.' using errcode = '42501';
  end if;

  if coalesce(p_monto, 0) <= 0 then
    raise exception 'Monto requerido.' using errcode = '22023';
  end if;

  select * into v_account
  from public.payments_accounts
  where id = p_account_id
    and empresa_id = v_empresa_id
  for update;

  if v_account.id is null then
    raise exception 'Cuenta no encontrada.' using errcode = '02000';
  end if;

  if v_account.estado in ('pagada', 'anulada') then
    raise exception 'La cuenta no acepta nuevos movimientos.' using errcode = '22023';
  end if;

  if p_monto > v_account.saldo then
    raise exception 'El monto no puede superar el saldo pendiente.' using errcode = '22023';
  end if;

  v_amount := p_monto;

  insert into public.payments_transactions (
    empresa_id,
    account_id,
    tipo,
    monto,
    metodo,
    referencia,
    notas,
    created_by
  )
  values (
    v_empresa_id,
    p_account_id,
    'payment',
    v_amount,
    coalesce(nullif(btrim(p_metodo), ''), 'manual'),
    nullif(btrim(coalesce(p_referencia, '')), ''),
    nullif(btrim(coalesce(p_notas, '')), ''),
    v_user_id
  );

  v_new_saldo := v_account.saldo - v_amount;

  update public.payments_accounts
  set
    saldo = v_new_saldo,
    estado = case when v_new_saldo = 0 then 'pagada' else 'parcial' end,
    updated_by = v_user_id
  where id = p_account_id
    and empresa_id = v_empresa_id;

  return query
  select p_account_id, v_new_saldo, case when v_new_saldo = 0 then 'pagada' else 'parcial' end;
end;
$$;

