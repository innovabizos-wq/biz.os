-- Server-only administrative flows create Auth users and their tenant profile
-- in separate calls. The service role must be able to write both records;
-- authenticated browser clients remain subject to their existing grants and RLS.
grant select, insert, update, delete on table public.profiles to service_role;
grant select, insert, update, delete on table public.auditoria_eventos to service_role;
