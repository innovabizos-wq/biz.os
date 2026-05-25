import { NextResponse, type NextRequest } from "next/server";

const PENDING_INVITATION_COOKIE = "bizos_pending_invitation_token";
const PENDING_INVITATION_MAX_AGE = 60 * 60 * 24 * 7;

export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  const token =
    request.nextUrl.searchParams.get("token") ??
    request.nextUrl.searchParams.get("invitation_token");
  const normalizedToken = token?.trim();

  if (normalizedToken) {
    if (process.env.NODE_ENV !== "production") {
      console.info("[middleware] pending invitation token captured", {
        path: request.nextUrl.pathname,
        tokenLength: normalizedToken.length,
      });
    }
    response.cookies.set(PENDING_INVITATION_COOKIE, normalizedToken, {
      httpOnly: true,
      maxAge: PENDING_INVITATION_MAX_AGE,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
  } else if (process.env.NODE_ENV !== "production") {
    console.info("[middleware] pass", {
      path: request.nextUrl.pathname,
      setsInvitationCookie: false,
    });
  }

  return response;
}

export const config = {
  matcher: ["/invitation", "/login", "/signup", "/onboarding"],
};
