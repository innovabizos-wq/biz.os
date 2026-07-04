import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentProfile, getCurrentUser } from "@/lib/auth/session";
import { loginAction } from "@/modules/auth/actions";
import { getPendingInvitationToken } from "@/modules/users/invitations/invitation-cookie";
import { Button, buttonVariants } from "@/components/ui/button";

type LoginPageProps = {
  searchParams?: Promise<{
    error?: string;
    invitation_token?: string;
    notice?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const [pendingInvitationToken, userResult, profileResult] = await Promise.all([
    getPendingInvitationToken(),
    getCurrentUser(),
    getCurrentProfile(),
  ]);
  const invitationToken = params?.invitation_token ?? pendingInvitationToken;

  if (userResult.ok && userResult.data && profileResult.ok && profileResult.data) {
    if (process.env.NODE_ENV !== "production") {
      console.info("[loginPage] active session found; redirect dashboard");
    }
    redirect("/dashboard");
  }

  if (
    userResult.ok &&
    userResult.data &&
    profileResult.ok &&
    !profileResult.data &&
    invitationToken
  ) {
    if (process.env.NODE_ENV !== "production") {
      console.info("[loginPage] session without profile; redirect invitation");
    }
    redirect(`/invitation?token=${encodeURIComponent(invitationToken)}`);
  }

  const signupHref = invitationToken
    ? `/signup?invitation_token=${encodeURIComponent(invitationToken)}`
    : "/signup";

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted px-6">
      <form
        action={loginAction}
        className="w-full max-w-sm space-y-6 rounded-lg bg-background p-6 shadow-sm"
      >
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">biz.os</p>
          <h1 className="text-2xl font-semibold tracking-tight">
            Acceso operativo
          </h1>
          <p className="text-sm text-muted-foreground">
            Ingresa con Supabase Auth. Si estas aceptando una invitacion, usa el
            mismo correo invitado.
          </p>
        </div>

        {params?.notice === "confirm-email" ? (
          <p className="rounded-md border bg-muted p-3 text-sm text-muted-foreground">
            Revisa tu correo para confirmar la cuenta antes de continuar.
          </p>
        ) : null}

        {params?.notice === "confirm-email-invitation" ? (
          <p className="rounded-md border bg-muted p-3 text-sm text-muted-foreground">
            Confirma tu correo. Luego inicia sesion y biz.os continuara con la
            invitacion automaticamente.
          </p>
        ) : null}

        {invitationToken ? (
          <p className="rounded-md border bg-muted p-3 text-sm text-muted-foreground">
            Despues de iniciar sesion volveras a la invitacion. No se creara una
            empresa nueva.
          </p>
        ) : null}

        {params?.error ? (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {params.error}
          </p>
        ) : null}

        <div className="space-y-3">
          <label className="block text-sm font-medium" htmlFor="email">
            Correo
          </label>
          <input
            className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
            id="email"
            name="email"
            placeholder="usuario@empresa.com"
            type="email"
          />
        </div>

        <div className="space-y-3">
          <label className="block text-sm font-medium" htmlFor="password">
            Contrasena
          </label>
          <input
            className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
            id="password"
            name="password"
            placeholder="********"
            type="password"
          />
        </div>

        {invitationToken ? (
          <input name="invitation_token" type="hidden" value={invitationToken} />
        ) : null}

        <Button className="w-full" type="submit">
          Iniciar sesion
        </Button>

        <Link
          className={buttonVariants({ className: "w-full", variant: "outline" })}
          href={signupHref}
        >
          Crear cuenta
        </Link>
      </form>
    </main>
  );
}
