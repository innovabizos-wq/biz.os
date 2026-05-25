import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

function getSupabaseServerConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    throw new Error("Missing public Supabase environment variables.");
  }

  return { publishableKey, url };
}

export async function createClient() {
  const cookieStore = await cookies();
  const { publishableKey, url } = getSupabaseServerConfig();

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
