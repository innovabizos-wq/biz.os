"use client";

import { createBrowserClient } from "@supabase/ssr";

function getSupabaseBrowserConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    throw new Error("Missing public Supabase environment variables.");
  }

  return { publishableKey, url };
}

export function createClient() {
  const { publishableKey, url } = getSupabaseBrowserConfig();

  return createBrowserClient(url, publishableKey);
}
