import Link from "next/link";

import { signupAction } from "@/modules/auth/actions";
import { getPendingInvitationToken } from "@/modules/users/invitations/invitation-cookie";
import { Button, buttonVariants } from "@/components/ui/button";

type SignupPageProps = {
  searchParams?: Promise<{
    error?: string;
    invitation_token?: string;
  }>;
};

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const params = await searchParams;
  const pendingInvitationToken = await getPendingInvitationToken();
  const invitationToken = params?.invitation_token ?? pendingInvitationToken;
  const loginHref = invitationToken
    ? `/login?invitation_token=${encodeURIComponent(invitationToken)}`
    : "/login";

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted px-6">
      <form
        action={signupAction}
        className="w-full max-w-sm space-y-6 rounded-lg border bg-background p-6 shadow-sm"
      >
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">biz.os</p>
          <h1 className="text-2xl font-semibold tracking-tight">Crear cuenta</h1>
          <p className="text-sm text-muted-foreground">
            Crea tu usuario operativo. Si estas aceptando una invitacion, usa el
            mismo correo invitado.
          </p>
        </div>

        {invitationToken ? (
          <p className="rounded-md border bg-muted p-3 text-sm text-muted-foreground">
            Esta cuenta se usara para aceptar una invitacion a una empresa
            existente. No se creara una empresa nueva.
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
            placeholder="Minimo 8 caracteres"
            type="password"
          />
        </div>

        {invitationToken ? (
          <input name="invitation_token" type="hidden" value={invitationToken} />
        ) : null}

        <Button className="w-full" type="submit">
          Crear cuenta
        </Button>

        <Link
          className={buttonVariants({ className: "w-full", variant: "outline" })}
          href={loginHref}
        >
          Ya tengo cuenta
        </Link>
      </form>
    </main>
  );
}
