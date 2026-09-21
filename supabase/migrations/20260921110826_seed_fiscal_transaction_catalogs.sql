-- Required transaction catalogs from the bundled Hacienda XML 4.4 schemas.

insert into public.fiscal_sale_conditions (code, label, is_active)
values
  ('01', 'Contado', true),
  ('02', 'Credito', true),
  ('03', 'Consignacion', true),
  ('04', 'Apartado', true),
  ('05', 'Arrendamiento con opcion de compra', true),
  ('06', 'Arrendamiento en funcion financiera', true),
  ('07', 'Cobro a favor de un tercero', true),
  ('08', 'Servicios prestados al Estado a credito', true),
  ('10', 'Venta a credito en IVA hasta 90 dias', true),
  ('12', 'Venta de mercancia no nacionalizada', true),
  ('13', 'Venta de bienes usados por no contribuyente', true),
  ('14', 'Arrendamiento operativo', true),
  ('15', 'Arrendamiento financiero', true),
  ('99', 'Otros', true)
on conflict (code) do update
set label = excluded.label,
    is_active = excluded.is_active;

insert into public.fiscal_payment_methods (code, label, supports_amount, is_active)
values
  ('01', 'Efectivo', true, true),
  ('02', 'Tarjeta', true, true),
  ('03', 'Cheque', true, true),
  ('04', 'Transferencia o deposito bancario', true, true),
  ('05', 'Recaudado por terceros', true, true),
  ('06', 'SINPE Movil', true, true),
  ('07', 'Plataforma digital', true, true),
  ('99', 'Otros', true, true)
on conflict (code) do update
set label = excluded.label,
    supports_amount = excluded.supports_amount,
    is_active = excluded.is_active;
