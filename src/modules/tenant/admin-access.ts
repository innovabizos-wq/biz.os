import { redirect } from "next/navigation";

import { getAdminAccessState } from "@/modules/tenant/queries";

export async function requireAdminAccess() {
  const access = await getAdminAccessState();

  if (access.status === "unauthenticated") {
    redirect("/login");
  }

  if (access.status === "needs_onboarding") {
    redirect("/onboarding");
  }

  return access;
}
