-- Cover dispatch mobile composite foreign keys in their declared column order.

create index if not exists dispatch_mobile_operations_despacho_empresa_fkey_idx
  on public.dispatch_mobile_operations (despacho_id, empresa_id);
create index if not exists dispatch_mobile_operations_created_by_empresa_fkey_idx
  on public.dispatch_mobile_operations (creado_por, empresa_id);
create index if not exists dispatch_delivery_evidence_despacho_empresa_fkey_idx
  on public.dispatch_delivery_evidence (despacho_id, empresa_id);
create index if not exists dispatch_delivery_evidence_created_by_empresa_fkey_idx
  on public.dispatch_delivery_evidence (creado_por, empresa_id);
