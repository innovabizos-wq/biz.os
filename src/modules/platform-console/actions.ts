"use server";

import { requirePlatformAccess } from "@/modules/platform-console/guards";

export async function assertPlatformWriteAccess() {
  await requirePlatformAccess(["owner", "admin"]);

  return {
    ok: false,
    message: "Platform Console write actions are not implemented in this phase.",
  };
}

