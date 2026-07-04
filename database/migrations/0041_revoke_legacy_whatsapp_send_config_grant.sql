-- Close the legacy authenticated RPC grant that returned WhatsApp access tokens.
-- Server sends now use obtener_inbox_whatsapp_send_config_server via service_role.

revoke all on function public.obtener_inbox_whatsapp_send_config(uuid)
from anon, authenticated, public;

revoke all on function public.obtener_inbox_whatsapp_send_config_server(uuid, uuid, uuid)
from anon, authenticated, public;

grant execute on function public.obtener_inbox_whatsapp_send_config_server(uuid, uuid, uuid)
to service_role;
