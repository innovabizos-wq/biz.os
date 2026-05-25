export function buildInvitationUrl(token: string): string {
  const path = `/invitation?token=${encodeURIComponent(token)}`;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");

  return baseUrl ? `${baseUrl}${path}` : path;
}
