-- Stable, tenant-scoped CRM customer numbers.

alter table public.crm_clientes
  add column if not exists numero integer;

with numbered as (
  select
    id,
    row_number() over (
      partition by empresa_id
      order by created_at, id
    )::integer as numero
  from public.crm_clientes
)
update public.crm_clientes as cliente
set numero = numbered.numero
from numbered
where numbered.id = cliente.id
  and cliente.numero is null;

create or replace function public.asignar_crm_cliente_numero()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.numero is null then
    perform pg_advisory_xact_lock(hashtext(new.empresa_id::text));

    select coalesce(max(cliente.numero), 0) + 1
    into new.numero
    from public.crm_clientes as cliente
    where cliente.empresa_id = new.empresa_id;
  end if;

  return new;
end;
$$;

drop trigger if exists set_crm_cliente_numero on public.crm_clientes;
create trigger set_crm_cliente_numero
before insert on public.crm_clientes
for each row execute function public.asignar_crm_cliente_numero();

alter table public.crm_clientes
  alter column numero set not null;

alter table public.crm_clientes
  drop constraint if exists crm_clientes_numero_positive_check;
alter table public.crm_clientes
  add constraint crm_clientes_numero_positive_check check (numero > 0);

create unique index if not exists crm_clientes_empresa_numero_unique
  on public.crm_clientes (empresa_id, numero);
