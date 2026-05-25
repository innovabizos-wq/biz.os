import { redirect } from "next/navigation";

import { getCurrentProfile, getCurrentUser } from "@/lib/auth/session";
import { getPendingInvitationToken } from "@/modules/users/invitations/invitation-cookie";

export default async function Home() {
  const [userResult, profileResult, pendingInvitationToken] = await Promise.all([
    getCurrentUser(),
    getCurrentProfile(),
    getPendingInvitationToken(),
  ]);

  if (!userResult.ok || !userResult.data) {
    redirect("/login");
  }

  if (profileResult.ok && profileResult.data) {
    redirect("/dashboard");
  }

  if (pendingInvitationToken) {
    redirect(`/invitation?token=${encodeURIComponent(pendingInvitationToken)}`);
  }

  redirect("/onboarding");
}
