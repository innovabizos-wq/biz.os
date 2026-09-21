import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";

// Supabase Auth (via @supabase/ssr) usa flujo PKCE. Los links de confirmacion
// de correo, invitacion, magic link, etc. llegan aqui con un `?code=...` que
// hay que canjear por una sesion real. Sin esta ruta, el usuario llega a
// /onboarding (o /invitation) sin sesion y termina rebotado a /login.
function safeNextPath(next: string | null): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return "/onboarding";
  }

  return next;
}

export async function GET(request: NextRequest) {
  const { origin, searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));

  if (!code) {
    const params = new URLSearchParams({
      error: "El enlace de confirmacion no es valido o ya expiro.",
    });
    return NextResponse.redirect(`${origin}/login?${params.toString()}`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("[auth/callback] exchangeCodeForSession failed", {
      message: error.message,
      name: error.name,
      status: error.status,
    });

    const params = new URLSearchParams({
      error:
        "No se pudo confirmar el correo (el enlace pudo haber expirado). Intenta iniciar sesion o solicita un enlace nuevo.",
    });
    return NextResponse.redirect(`${origin}/login?${params.toString()}`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
