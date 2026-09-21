import "server-only";

import { AsyncLocalStorage } from "node:async_hooks";

const delegatedAccessToken = new AsyncLocalStorage<string>();

export function getDelegatedSupabaseAccessToken() {
  return delegatedAccessToken.getStore() ?? null;
}

export function runWithDelegatedSupabaseAccessToken<T>(
  accessToken: string,
  callback: () => Promise<T>,
) {
  return delegatedAccessToken.run(accessToken, callback);
}
