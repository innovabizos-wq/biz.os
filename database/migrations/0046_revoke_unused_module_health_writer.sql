-- Harden module health writes.
-- The app recalculates module health through guarded server actions and does
-- not call registrar_estado_salud_modulo directly. Keep this writer out of the
-- authenticated REST RPC surface.

revoke all on function public.registrar_estado_salud_modulo(text, text, boolean, boolean, text, jsonb)
from anon, authenticated, public;

grant execute on function public.registrar_estado_salud_modulo(text, text, boolean, boolean, text, jsonb)
to service_role;
