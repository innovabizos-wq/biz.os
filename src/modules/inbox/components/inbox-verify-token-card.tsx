import { regenerateMetaVerifyTokenAction } from "@/modules/inbox/actions";
import { Button } from "@/components/ui/button";

type InboxVerifyTokenCardProps = {
  canalId: string;
  canManage: boolean;
  verifyToken?: string;
};

export function InboxVerifyTokenCard({
  canalId,
  canManage,
  verifyToken,
}: InboxVerifyTokenCardProps) {
  return (
    <div className="rounded-lg border bg-background p-5">
      <p className="font-semibold">Verify token</p>
      <p className="mt-2 text-sm text-muted-foreground">
        Si pierdes el valor, debes regenerarlo y actualizarlo en Meta.
      </p>
      {verifyToken ? (
        <div className="mt-4 rounded-md border border-amber-300 bg-amber-50 p-3">
          <p className="text-sm font-medium text-amber-950">
            Token generado. Copialo ahora.
          </p>
          <p className="mt-2 break-all font-mono text-sm text-amber-950">
            {verifyToken}
          </p>
        </div>
      ) : null}
      {canManage ? (
        <form action={regenerateMetaVerifyTokenAction} className="mt-4">
          <input name="canalId" type="hidden" value={canalId} />
          <Button type="submit" variant="outline">
            Regenerar verify token
          </Button>
        </form>
      ) : null}
    </div>
  );
}
