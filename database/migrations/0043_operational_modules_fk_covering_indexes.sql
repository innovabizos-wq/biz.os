-- Covering FK indexes for operational modules introduced in 0042.
-- Additive only; do not remove unused indexes without a usage window.

create index if not exists ai_usage_events_profile_empresa_fkey_idx
  on public.ai_usage_events (profile_id, empresa_id);

create index if not exists payments_accounts_venta_empresa_fkey_idx
  on public.payments_accounts (venta_id, empresa_id);
create index if not exists payments_accounts_cliente_empresa_fkey_idx
  on public.payments_accounts (cliente_id, empresa_id);
create index if not exists payments_accounts_created_by_empresa_fkey_idx
  on public.payments_accounts (created_by, empresa_id);
create index if not exists payments_accounts_updated_by_empresa_fkey_idx
  on public.payments_accounts (updated_by, empresa_id);

create index if not exists payments_transactions_account_empresa_fkey_idx
  on public.payments_transactions (account_id, empresa_id);
create index if not exists payments_transactions_created_by_empresa_fkey_idx
  on public.payments_transactions (created_by, empresa_id);

create index if not exists purchases_suppliers_created_by_empresa_fkey_idx
  on public.purchases_suppliers (created_by, empresa_id);
create index if not exists purchases_suppliers_updated_by_empresa_fkey_idx
  on public.purchases_suppliers (updated_by, empresa_id);

create index if not exists purchases_orders_supplier_empresa_fkey_idx
  on public.purchases_orders (supplier_id, empresa_id);
create index if not exists purchases_orders_bodega_empresa_fkey_idx
  on public.purchases_orders (bodega_id, empresa_id);
create index if not exists purchases_orders_created_by_empresa_fkey_idx
  on public.purchases_orders (created_by, empresa_id);
create index if not exists purchases_orders_updated_by_empresa_fkey_idx
  on public.purchases_orders (updated_by, empresa_id);

create index if not exists purchases_order_items_order_empresa_fkey_idx
  on public.purchases_order_items (order_id, empresa_id);
create index if not exists purchases_order_items_producto_empresa_fkey_idx
  on public.purchases_order_items (producto_id, empresa_id);
