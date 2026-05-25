import { saveMetaChannelSecretsAction } from "@/modules/inbox/actions";
import { Button } from "@/components/ui/button";

type InboxMetaSecretsFormProps = {
  canalId: string;
  canManage: boolean;
};

export function InboxMetaSecretsForm({
  canalId,
  canManage,
}: InboxMetaSecretsFormProps) {
  if (!canManage) return null;

  return (
    <form action={saveMetaChannelSecretsAction} className="rounded-lg border bg-background p-5">
      <input name="canalId" type="hidden" value={canalId} />
      <p className="font-semibold">Secretos Meta</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Estos valores se guardan en tabla privada. No se muestran completos
        despues de guardar.
      </p>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="font-medium">access_token</span>
          <input
            autoComplete="off"
            className="h-9 w-full rounded-md border bg-background px-3"
            name="accessToken"
            type="password"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">app_secret</span>
          <input
            autoComplete="off"
            className="h-9 w-full rounded-md border bg-background px-3"
            name="appSecret"
            type="password"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">verify_token</span>
          <input
            autoComplete="off"
            className="h-9 w-full rounded-md border bg-background px-3"
            name="verifyToken"
            type="password"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">Expiracion token</span>
          <input
            className="h-9 w-full rounded-md border bg-background px-3"
            name="tokenExpiresAt"
            type="datetime-local"
          />
        </label>
      </div>
      <Button className="mt-4" type="submit">
        Guardar secretos
      </Button>
    </form>
  );
}
