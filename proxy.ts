import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PENDING_INVITATION_COOKIE = "bizos_pending_invitation_token";
const PENDING_INVITATION_MAX_AGE = 60 * 60 * 24 * 7;

function getSupabaseProxyConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    throw new Error("Missing public Supabase environment variables.");
  }

  return { publishableKey, url };
}

function capturePendingInvitationToken(
  request: NextRequest,
  response: NextResponse,
) {
  const token =
    request.nextUrl.searchParams.get("token") ??
    request.nextUrl.searchParams.get("invitation_token");
  const normalizedToken = token?.trim();

  if (normalizedToken) {
    if (process.env.NODE_ENV !== "production") {
      console.info("[proxy] pending invitation token captured", {
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
    console.info("[proxy] pass", {
      path: request.nextUrl.pathname,
      setsInvitationCookie: false,
    });
  }

  return response;
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({
    request,
  });
  const { publishableKey, url } = getSupabaseProxyConfig();

  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });

        response = NextResponse.next({
          request,
        });

        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  await supabase.auth.getUser();

  return capturePendingInvitationToken(request, response);
}

export const config = {
  matcher: [
    "/((?!api|\\.well-known/workflow|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
