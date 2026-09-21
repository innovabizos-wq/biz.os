import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { getCurrentProfile, getCurrentUser } from "@/lib/auth/session";
import { completeFirstPasswordChangeAction } from "@/modules/auth/actions";

type ChangePasswordPageProps = {
  searchParams?: Promise<{ error?: string }>;
};

export default async function ChangePasswordPage({
  searchParams,
}: ChangePasswordPageProps) {
  const [params, userResult, profileResult] = await Promise.all([
    searchParams,
    getCurrentUser(),
    getCurrentProfile(),
  ]);

  if (!userResult.ok || !userResult.data) {
    redirect("/login");
  }

  if (!profileResult.ok || !profileResult.data) {
    redirect("/login");
  }

  if (!profileResult.data.requiereCambioContrasena) {
    redirect("/dashboard");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted px-6">
      <form action={completeFirstPasswordChangeAction} className="w-full max-w-sm space-y-6 rounded-lg bg-background p-6 shadow-sm">
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">biz.os</p>
          <h1 className="text-2xl font-semibold tracking-tight">Cambia tu contrasena</h1>
          <p className="text-sm text-muted-foreground">
            Tu administrador creo este acceso. Define una contrasena personal para continuar.
          </p>
        </div>

        {params?.error ? (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {params.error}
          </p>
        ) : null}

        <label className="block space-y-3 text-sm font-medium" htmlFor="password">
          Nueva contrasena
          <input className="h-10 w-full rounded-md border bg-background px-3 text-sm" id="password" minLength={12} name="password" required type="password" />
        </label>
        <label className="block space-y-3 text-sm font-medium" htmlFor="passwordConfirmation">
          Confirmar nueva contrasena
          <input className="h-10 w-full rounded-md border bg-background px-3 text-sm" id="passwordConfirmation" minLength={12} name="passwordConfirmation" required type="password" />
        </label>

        <Button className="w-full" type="submit">Guardar y continuar</Button>
      </form>
    </main>
  );
}
