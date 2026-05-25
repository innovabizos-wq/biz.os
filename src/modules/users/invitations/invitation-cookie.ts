import { cookies } from "next/headers";

export const PENDING_INVITATION_COOKIE = "bizos_pending_invitation_token";
export const PENDING_INVITATION_MAX_AGE = 60 * 60 * 24 * 7;

function normalizeInvitationToken(token: string | null | undefined) {
  const normalized = token?.trim();

  return normalized || null;
}

export async function setPendingInvitationToken(token: string) {
  const normalized = normalizeInvitationToken(token);

  if (!normalized) {
    return;
  }

  const cookieStore = await cookies();
  cookieStore.set(PENDING_INVITATION_COOKIE, normalized, {
    httpOnly: true,
    maxAge: PENDING_INVITATION_MAX_AGE,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

export async function getPendingInvitationToken() {
  const cookieStore = await cookies();

  return normalizeInvitationToken(
    cookieStore.get(PENDING_INVITATION_COOKIE)?.value,
  );
}

export async function clearPendingInvitationToken() {
  const cookieStore = await cookies();
  cookieStore.set(PENDING_INVITATION_COOKIE, "", {
    httpOnly: true,
    maxAge: 0,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}
