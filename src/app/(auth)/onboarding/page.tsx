import { redirect } from "next/navigation";
import Link from "next/link";

import {
  bootstrapEmpresaInicialAction,
  signOutAction,
} from "@/modules/auth/actions";
import { getCurrentProfile, getCurrentUser } from "@/lib/auth/session";
import { getPendingInvitationToken } from "@/modules/users/invitations/invitation-cookie";
import { Button, buttonVariants } from "@/components/ui/button";

type OnboardingPageProps = {
  searchParams?: Promise<{
    error?: string;
    invitation_token?: string;
    token?: string;
  }>;
};

export default async function OnboardingPage({
  searchParams,
}: OnboardingPageProps) {
  const [params, userResult, profileResult] = await Promise.all([
    searchParams,
    getCurrentUser(),
    getCurrentProfile(),
  ]);
  const invitationToken = params?.invitation_token ?? params?.token;
  const pendingInvitationToken = await getPendingInvitationToken();

  if (invitationToken) {
    redirect(`/invitation?token=${encodeURIComponent(invitationToken)}`);
  }

  if (!userResult.ok || !userResult.data) {
    redirect("/login");
  }

  if (profileResult.ok && profileResult.data) {
    redirect("/dashboard");
  }

  if (pendingInvitationToken) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-muted px-6">
        <section className="w-full max-w-lg space-y-5 rounded-lg border bg-background p-6 shadow-sm">
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">biz.os</p>
            <h1 className="text-2xl font-semibold tracking-tight">
              Tenes una invitacion pendiente
            </h1>
            <p className="text-sm leading-6 text-muted-foreground">
              No necesitas crear una empresa nueva. La invitacion agrega tu
              usuario a una empresa existente y se validara con tu cuenta
              autenticada.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              className={buttonVariants()}
              href={`/invitation?token=${encodeURIComponent(pendingInvitationToken)}`}
            >
              Continuar con mi invitacion
            </Link>
            <form action={signOutAction}>
              <Button type="submit" variant="outline">
                Salir
              </Button>
            </form>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted px-6 py-10">
      <section className="w-full max-w-2xl space-y-6 rounded-lg border bg-background p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">biz.os</p>
            <h1 className="text-2xl font-semibold tracking-tight">
              Alta inicial de empresa
            </h1>
            <p className="text-sm text-muted-foreground">
              Este paso crea tu empresa, sucursal principal, rol administrador,
              modulos iniciales y plan starter.
            </p>
            <p className="text-sm text-muted-foreground">
              Si recibiste una invitacion, usa el enlace de invitacion. Este
              formulario es solo para crear una empresa nueva.
            </p>
          </div>
          <form action={signOutAction}>
            <Button type="submit" variant="outline">
              Salir
            </Button>
          </form>
        </div>

        {params?.error ? (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {params.error}
          </p>
        ) : null}

        <form action={bootstrapEmpresaInicialAction} className="grid gap-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="block text-sm font-medium" htmlFor="nombreEmpresa">
                Nombre de empresa
              </label>
              <input
                className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
                id="nombreEmpresa"
                name="nombreEmpresa"
                required
              />
            </div>

            <div className="space-y-2">
              <label
                className="block text-sm font-medium"
                htmlFor="nombreComercial"
              >
                Nombre comercial
              </label>
              <input
                className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
                id="nombreComercial"
                name="nombreComercial"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label
                className="block text-sm font-medium"
                htmlFor="identificacionFiscal"
              >
                Identificacion fiscal
              </label>
              <input
                className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
                id="identificacionFiscal"
                name="identificacionFiscal"
              />
            </div>

            <div className="space-y-2">
              <label
                className="block text-sm font-medium"
                htmlFor="telefonoEmpresa"
              >
                Telefono empresa
              </label>
              <input
                className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
                id="telefonoEmpresa"
                name="telefonoEmpresa"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="block text-sm font-medium" htmlFor="nombreUsuario">
                Nombre del usuario
              </label>
              <input
                className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
                id="nombreUsuario"
                name="nombreUsuario"
                required
              />
            </div>

            <div className="space-y-2">
              <label
                className="block text-sm font-medium"
                htmlFor="telefonoUsuario"
              >
                Telefono usuario
              </label>
              <input
                className="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
                id="telefonoUsuario"
                name="telefonoUsuario"
              />
            </div>
          </div>

          <Button className="mt-2" type="submit">
            Crear empresa inicial
          </Button>
        </form>
      </section>
    </main>
  );
}
