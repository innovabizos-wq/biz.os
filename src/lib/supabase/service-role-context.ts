import "server-only";

import { AsyncLocalStorage } from "node:async_hooks";

import { createServiceRoleClient } from "@/lib/supabase/admin";

type ServiceRoleClient = ReturnType<typeof createServiceRoleClient>;

const serviceRoleContext = new AsyncLocalStorage<ServiceRoleClient>();

export function getServiceRoleSupabaseContext() {
  return serviceRoleContext.getStore() ?? null;
}

export function runWithServiceRoleSupabase<T>(operation: () => Promise<T>) {
  return serviceRoleContext.run(createServiceRoleClient(), operation);
}
