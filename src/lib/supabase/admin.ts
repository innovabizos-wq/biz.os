import { createClient as createSupabaseClient } from "@supabase/supabase-js";

function getSupabaseAdminConfig() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!url || !serviceRoleKey) {
    throw new Error("Missing Supabase service role environment variables.");
  }

  return { serviceRoleKey, url };
}

export function createServiceRoleClient() {
  const { serviceRoleKey, url } = getSupabaseAdminConfig();

  return createSupabaseClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
