import { saveMetaChannelSecretsAction } from "@/modules/inbox/actions";
import type { InboxMetaChannelStatus } from "@/modules/inbox/types";
import { Button } from "@/components/ui/button";

type InboxMetaSecretsFormProps = {
  canalId: string;
  canManage: boolean;
  metaStatus: InboxMetaChannelStatus | null;
};

function SecretStatusBadge({ configured }: { configured: boolean }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${
        configured
          ? "bg-emerald-100 text-emerald-800"
          : "bg-slate-100 text-slate-600"
      }`}
    >
      {configured ? "Configurado" : "No configurado"}
    </span>
  );
}

function formatTokenExpiration(value: string | null | undefined) {
  if (!value) return "No registrada";

  return new Intl.DateTimeFormat("es-CR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatTokenUpdatedAt(value: string | null | undefined) {
  if (!value) return "No registrada";

  return new Intl.DateTimeFormat("es-CR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatTokenSuffix(value: string | null | undefined) {
  return value ? `...${value}` : "No disponible";
}

export function InboxMetaSecretsForm({
  canalId,
  canManage,
  metaStatus,
}: InboxMetaSecretsFormProps) {
  if (!canManage) return null;

  return (
    <form
      action={saveMetaChannelSecretsAction}
      className="rounded-lg border bg-background p-5"
    >
      <input name="canalId" type="hidden" value={canalId} />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-semibold">Secretos Meta</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Por seguridad, los secretos guardados no se muestran. Si dejas un
            campo vacio, se conserva el valor actual. Si escribes un valor nuevo,
            reemplaza el valor anterior.
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-md border bg-muted/50 p-4">
        <p className="text-sm font-medium">Estado seguro de secretos</p>
        <dl className="mt-3 grid gap-3 text-sm md:grid-cols-2">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted-foreground">Access token</dt>
            <dd>
              <SecretStatusBadge configured={Boolean(metaStatus?.tieneAccessToken)} />
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted-foreground">App secret</dt>
            <dd>
              <SecretStatusBadge configured={Boolean(metaStatus?.tieneAppSecret)} />
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted-foreground">Verify token</dt>
            <dd>
              <SecretStatusBadge configured={Boolean(metaStatus?.tieneVerifyToken)} />
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted-foreground">Token actualizado</dt>
            <dd className="text-right font-medium">
              {formatTokenUpdatedAt(metaStatus?.accessTokenUpdatedAt)}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted-foreground">Huella token</dt>
            <dd className="text-right font-mono text-xs">
              {formatTokenSuffix(metaStatus?.accessTokenSuffix)}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted-foreground">Expiracion token</dt>
            <dd className="text-right font-medium">
              {formatTokenExpiration(metaStatus?.tokenExpiresAt)}
            </dd>
          </div>
        </dl>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="font-medium">access_token</span>
          <input
            autoComplete="off"
            className="h-9 w-full rounded-md border bg-background px-3"
            name="accessToken"
            placeholder="Dejar vacio para conservar el token actual"
            type="password"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">app_secret</span>
          <input
            autoComplete="off"
            className="h-9 w-full rounded-md border bg-background px-3"
            name="appSecret"
            placeholder="Dejar vacio para conservar el app secret actual"
            type="password"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">verify_token</span>
          <input
            autoComplete="off"
            className="h-9 w-full rounded-md border bg-background px-3"
            name="verifyToken"
            placeholder="Dejar vacio para conservar el verify token actual"
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
        Guardar / actualizar secretos
      </Button>
    </form>
  );
}
