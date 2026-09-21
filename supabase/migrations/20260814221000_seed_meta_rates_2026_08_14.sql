update public.inbox_campana_destinatarios
set market_code = case upper(market_code)
  when 'CR' then 'REST_OF_LATIN_AMERICA'
  when 'COSTA_RICA' then 'REST_OF_LATIN_AMERICA'
  when 'MX' then 'MEXICO'
  else upper(market_code)
end
where market_code is not null;

update public.inbox_meta_costos_mensajes
set market_code = case upper(market_code)
  when 'CR' then 'REST_OF_LATIN_AMERICA'
  when 'COSTA_RICA' then 'REST_OF_LATIN_AMERICA'
  when 'MX' then 'MEXICO'
  else upper(market_code)
end
where market_code is not null;

insert into public.inbox_meta_tarifas (
  market_code, categoria, currency, unit_cost,
  effective_from, effective_to, source_url, volume_from, volume_to, pricing_basis
)
values
  ('REST_OF_LATIN_AMERICA', 'MARKETING', 'USD', 0.0740, '2026-08-14', null, 'https://whatsappbusiness.com/products/platform-pricing/', 1, null, 'DELIVERED_MESSAGE'),
  ('REST_OF_LATIN_AMERICA', 'SERVICE', 'USD', 0.0000, '2026-08-14', null, 'https://whatsappbusiness.com/products/platform-pricing/', 1, null, 'DELIVERED_MESSAGE'),
  ('REST_OF_LATIN_AMERICA', 'UTILITY', 'USD', 0.0113, '2026-08-14', null, 'https://whatsappbusiness.com/products/platform-pricing/', 1, 100000, 'DELIVERED_MESSAGE'),
  ('REST_OF_LATIN_AMERICA', 'UTILITY', 'USD', 0.0107, '2026-08-14', null, 'https://whatsappbusiness.com/products/platform-pricing/', 100001, 1000000, 'DELIVERED_MESSAGE'),
  ('REST_OF_LATIN_AMERICA', 'UTILITY', 'USD', 0.0102, '2026-08-14', null, 'https://whatsappbusiness.com/products/platform-pricing/', 1000001, 4500000, 'DELIVERED_MESSAGE'),
  ('REST_OF_LATIN_AMERICA', 'UTILITY', 'USD', 0.0096, '2026-08-14', null, 'https://whatsappbusiness.com/products/platform-pricing/', 4500001, 15000000, 'DELIVERED_MESSAGE'),
  ('REST_OF_LATIN_AMERICA', 'UTILITY', 'USD', 0.0090, '2026-08-14', null, 'https://whatsappbusiness.com/products/platform-pricing/', 15000001, 30000000, 'DELIVERED_MESSAGE'),
  ('REST_OF_LATIN_AMERICA', 'UTILITY', 'USD', 0.0085, '2026-08-14', null, 'https://whatsappbusiness.com/products/platform-pricing/', 30000001, null, 'DELIVERED_MESSAGE'),
  ('REST_OF_LATIN_AMERICA', 'AUTHENTICATION', 'USD', 0.0113, '2026-08-14', null, 'https://whatsappbusiness.com/products/platform-pricing/', 1, 100000, 'DELIVERED_MESSAGE'),
  ('REST_OF_LATIN_AMERICA', 'AUTHENTICATION', 'USD', 0.0107, '2026-08-14', null, 'https://whatsappbusiness.com/products/platform-pricing/', 100001, 1000000, 'DELIVERED_MESSAGE'),
  ('REST_OF_LATIN_AMERICA', 'AUTHENTICATION', 'USD', 0.0102, '2026-08-14', null, 'https://whatsappbusiness.com/products/platform-pricing/', 1000001, 4500000, 'DELIVERED_MESSAGE'),
  ('REST_OF_LATIN_AMERICA', 'AUTHENTICATION', 'USD', 0.0096, '2026-08-14', null, 'https://whatsappbusiness.com/products/platform-pricing/', 4500001, 15000000, 'DELIVERED_MESSAGE'),
  ('REST_OF_LATIN_AMERICA', 'AUTHENTICATION', 'USD', 0.0090, '2026-08-14', null, 'https://whatsappbusiness.com/products/platform-pricing/', 15000001, 30000000, 'DELIVERED_MESSAGE'),
  ('REST_OF_LATIN_AMERICA', 'AUTHENTICATION', 'USD', 0.0085, '2026-08-14', null, 'https://whatsappbusiness.com/products/platform-pricing/', 30000001, null, 'DELIVERED_MESSAGE'),
  ('MEXICO', 'MARKETING', 'USD', 0.0305, '2026-08-14', null, 'https://whatsappbusiness.com/products/platform-pricing/', 1, null, 'DELIVERED_MESSAGE'),
  ('MEXICO', 'SERVICE', 'USD', 0.0000, '2026-08-14', null, 'https://whatsappbusiness.com/products/platform-pricing/', 1, null, 'DELIVERED_MESSAGE'),
  ('MEXICO', 'UTILITY', 'USD', 0.0085, '2026-08-14', null, 'https://whatsappbusiness.com/products/platform-pricing/', 1, 1000000, 'DELIVERED_MESSAGE'),
  ('MEXICO', 'UTILITY', 'USD', 0.0081, '2026-08-14', null, 'https://whatsappbusiness.com/products/platform-pricing/', 1000001, 5000000, 'DELIVERED_MESSAGE'),
  ('MEXICO', 'UTILITY', 'USD', 0.0077, '2026-08-14', null, 'https://whatsappbusiness.com/products/platform-pricing/', 5000001, 10000000, 'DELIVERED_MESSAGE'),
  ('MEXICO', 'UTILITY', 'USD', 0.0072, '2026-08-14', null, 'https://whatsappbusiness.com/products/platform-pricing/', 10000001, 20000000, 'DELIVERED_MESSAGE'),
  ('MEXICO', 'UTILITY', 'USD', 0.0068, '2026-08-14', null, 'https://whatsappbusiness.com/products/platform-pricing/', 20000001, 40000000, 'DELIVERED_MESSAGE'),
  ('MEXICO', 'UTILITY', 'USD', 0.0064, '2026-08-14', null, 'https://whatsappbusiness.com/products/platform-pricing/', 40000001, null, 'DELIVERED_MESSAGE'),
  ('MEXICO', 'AUTHENTICATION', 'USD', 0.0085, '2026-08-14', null, 'https://whatsappbusiness.com/products/platform-pricing/', 1, 1000000, 'DELIVERED_MESSAGE'),
  ('MEXICO', 'AUTHENTICATION', 'USD', 0.0081, '2026-08-14', null, 'https://whatsappbusiness.com/products/platform-pricing/', 1000001, 5000000, 'DELIVERED_MESSAGE'),
  ('MEXICO', 'AUTHENTICATION', 'USD', 0.0077, '2026-08-14', null, 'https://whatsappbusiness.com/products/platform-pricing/', 5000001, 10000000, 'DELIVERED_MESSAGE'),
  ('MEXICO', 'AUTHENTICATION', 'USD', 0.0072, '2026-08-14', null, 'https://whatsappbusiness.com/products/platform-pricing/', 10000001, 20000000, 'DELIVERED_MESSAGE'),
  ('MEXICO', 'AUTHENTICATION', 'USD', 0.0068, '2026-08-14', null, 'https://whatsappbusiness.com/products/platform-pricing/', 20000001, 40000000, 'DELIVERED_MESSAGE'),
  ('MEXICO', 'AUTHENTICATION', 'USD', 0.0064, '2026-08-14', null, 'https://whatsappbusiness.com/products/platform-pricing/', 40000001, null, 'DELIVERED_MESSAGE')
on conflict (market_code, categoria, currency, effective_from, volume_from)
do update set
  unit_cost = excluded.unit_cost,
  effective_to = excluded.effective_to,
  source_url = excluded.source_url,
  volume_to = excluded.volume_to,
  pricing_basis = excluded.pricing_basis;
