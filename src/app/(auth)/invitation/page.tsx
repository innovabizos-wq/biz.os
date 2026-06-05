import { redirect } from "next/navigation";
import Link from "next/link";

import { getCurrentProfile, getCurrentUser } from "@/lib/auth/session";
import { signOutAction } from "@/modules/auth/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { AcceptInvitationForm } from "@/modules/users/invitations/components/accept-invitation-form";
import { getPendingInvitationToken } from "@/modules/users/invitations/invitation-cookie";

type InvitationPageProps = {
  searchParams?: Promise<{
    error?: string;
    token?: string;
  }>;
};

export default async function InvitationPage({ searchParams }: InvitationPageProps) {
  const params = await searchParams;
  const pendingInvitationToken = await getPendingInvitationToken();
  const token = params?.token?.trim() ?? pendingInvitationToken;

  if (!params?.token && token) {
    redirect(`/invitation?token=${encodeURIComponent(token)}`);
  }
  const loginHref = token
    ? `/login?invitation_token=${encodeURIComponent(token)}`
    : "/login";
  const signupHref = token
    ? `/signup?invitation_token=${encodeURIComponent(token)}`
    : "/signup";

  if (!token) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-muted px-6">
        <div className="w-full max-w-md space-y-4 rounded-lg border bg-background p-6 shadow-sm">
          <p className="text-sm font-medium text-muted-foreground">biz.os</p>
          <h1 className="text-2xl font-semibold tracking-tight">
            Invitacion no valida
          </h1>
          <p className="text-sm text-muted-foreground">
            Falta el token de invitacion. Solicita un enlace nuevo al
            administrador de tu empresa.
          </p>
          <Link className={buttonVariants({ variant: "outline" })} href="/login">
            Ir a login
          </Link>
        </div>
      </main>
    );
  }

  const user = await getCurrentUser();

  if (!user.ok || !user.data) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-muted px-6">
        <div className="w-full max-w-md space-y-4 rounded-lg border bg-background p-6 shadow-sm">
          <p className="text-sm font-medium text-muted-foreground">biz.os</p>
          <h1 className="text-2xl font-semibold tracking-tight">
            Crear cuenta para aceptar invitacion
          </h1>
          <p className="text-sm text-muted-foreground">
            Inicia sesion o crea una cuenta con el mismo correo de la
            invitacion para entrar a una empresa existente. No se creara una
            empresa nueva.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link className={buttonVariants()} href={signupHref}>
              Crear cuenta para aceptar invitacion
            </Link>
            <Link className={buttonVariants({ variant: "outline" })} href={loginHref}>
              Iniciar sesion para aceptar invitacion
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const profile = await getCurrentProfile();

  if (profile.ok && profile.data) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-muted px-6">
        <div className="w-full max-w-md space-y-4 rounded-lg border bg-background p-6 shadow-sm">
          <p className="text-sm font-medium text-muted-foreground">biz.os</p>
          <h1 className="text-2xl font-semibold tracking-tight">
            Esta cuenta ya pertenece a una empresa
          </h1>
          <p className="text-sm text-muted-foreground">
            Esta cuenta ya pertenece a una empresa. Para aceptar esta
            invitacion usa otro correo.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link className={buttonVariants()} href="/dashboard">
              Ir al dashboard
            </Link>
            <form action={signOutAction}>
              <Button type="submit" variant="outline">
                Cerrar sesion
              </Button>
            </form>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted px-6">
      <div className="w-full max-w-md space-y-4">
        <div className="space-y-2 rounded-lg border bg-background p-6 shadow-sm">
          <p className="text-sm font-medium text-muted-foreground">biz.os</p>
          <h1 className="text-2xl font-semibold tracking-tight">
            Aceptar invitacion
          </h1>
          <p className="text-sm text-muted-foreground">
            Se validara el token, el correo autenticado y que esta cuenta no
            pertenezca ya a otra empresa.
          </p>
          {params?.error ? (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {params.error}
            </p>
          ) : null}
        </div>
        <AcceptInvitationForm token={token} />
      </div>
    </main>
  );
}
