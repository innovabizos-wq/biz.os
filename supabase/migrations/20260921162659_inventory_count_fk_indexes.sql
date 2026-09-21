-- Cover physical-count foreign keys in their declared column order.

drop index if exists public.inventory_count_items_stock_idx;

create index if not exists inventory_count_items_count_empresa_fkey_idx
  on public.inventory_count_items (count_id, empresa_id);

create index if not exists inventory_count_items_stock_id_fkey_idx
  on public.inventory_count_items (stock_id);
