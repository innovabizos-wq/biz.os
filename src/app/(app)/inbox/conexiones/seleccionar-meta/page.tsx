import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  decryptPendingMetaConnection,
  META_OAUTH_PENDING_COOKIE,
} from "@/modules/inbox/meta-oauth-pending";
import { requireAdminAccess } from "@/modules/tenant/admin-access";

export default async function SelectMetaPagesPage() {
  const access = await requireAdminAccess();
  const pending = decryptPendingMetaConnection(
    (await cookies()).get(META_OAUTH_PENDING_COOKIE)?.value,
  );
  if (
    !pending ||
    pending.empresaId !== access.tenant.empresaId ||
    pending.profileId !== access.tenant.profileId ||
    Date.now() - pending.issuedAt > 10 * 60 * 1000
  ) redirect("/inbox/conexiones?error=La%20seleccion%20de%20Meta%20expir%C3%B3.%20Vuelve%20a%20conectar.");

  return (
    <section className="mx-auto max-w-2xl space-y-6">
      <div>
        <p className="text-sm font-medium text-muted-foreground">Inbox · Meta</p>
        <h1 className="text-2xl font-semibold">Elige la página que quieres conectar</h1>
        <p className="mt-2 text-muted-foreground">
          Elige dónde quieres recibir los mensajes. Nosotros completaremos la conexión.
        </p>
      </div>
      <form action="/api/meta/connect/select" className="space-y-3" method="post">
        {pending.pages.map((page) => (
          <label className="flex cursor-pointer items-center gap-3 rounded-lg border p-4" key={page.id}>
            <input
              className="size-4"
              defaultChecked={pending.pages.length === 1}
              name="pageId"
              type="checkbox"
              value={page.id}
            />
            <span>
              <span className="block font-medium">{page.name}</span>
              <span className="block text-sm text-muted-foreground">Página de Facebook</span>
            </span>
          </label>
        ))}
        <Button className="w-full" type="submit">Continuar</Button>
      </form>
    </section>
  );
}
