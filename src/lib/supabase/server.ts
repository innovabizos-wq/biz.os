import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

import { getDelegatedSupabaseAccessToken } from "@/lib/supabase/delegated-auth";
import { getServiceRoleSupabaseContext } from "@/lib/supabase/service-role-context";

function getSupabaseServerConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    throw new Error("Missing public Supabase environment variables.");
  }

  return { publishableKey, url };
}

export async function createClient() {
  const serviceRoleClient = getServiceRoleSupabaseContext();
  if (serviceRoleClient) return serviceRoleClient;

  const { publishableKey, url } = getSupabaseServerConfig();
  const delegatedToken = getDelegatedSupabaseAccessToken();
  if (delegatedToken) {
    return createSupabaseClient(url, publishableKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${delegatedToken}` } },
    });
  }

  const cookieStore = await cookies();

  return createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components cannot set cookies. Middleware/actions can.
        }
      },
    },
  });
}
