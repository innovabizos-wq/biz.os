-- Unifica la configuracion de IA en la clave ai_provider.
-- La clave ai_conversation_layer queda obsoleta y se migra al nuevo registro.

insert into public.configuraciones_empresa (empresa_id, clave, valor)
select
  legacy.empresa_id,
  'ai_provider',
  jsonb_strip_nulls(coalesce(provider.valor, '{}'::jsonb) || coalesce(legacy.valor, '{}'::jsonb))
from public.configuraciones_empresa as legacy
left join public.configuraciones_empresa as provider
  on provider.empresa_id = legacy.empresa_id
 and provider.clave = 'ai_provider'
where legacy.clave = 'ai_conversation_layer'
on conflict on constraint configuraciones_empresa_clave_unique do update
set valor = excluded.valor;

delete from public.configuraciones_empresa
where clave = 'ai_conversation_layer';
