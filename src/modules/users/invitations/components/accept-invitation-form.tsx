import { acceptInvitationAction } from "@/modules/users/invitations/actions";
import { Button } from "@/components/ui/button";

type AcceptInvitationFormProps = {
  token: string;
};

export function AcceptInvitationForm({ token }: AcceptInvitationFormProps) {
  return (
    <form
      action={acceptInvitationAction}
      className="grid gap-4 rounded-lg border bg-background p-5 shadow-sm"
    >
      <input name="token" type="hidden" value={token} />
      <div>
        <h3 className="text-base font-semibold">Aceptar invitacion</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          La empresa se tomara desde la invitacion. No se solicita empresa_id.
        </p>
      </div>

      <label className="space-y-2 text-sm font-medium">
        Nombre visible
        <input
          className="h-10 w-full rounded-md border bg-background px-3 text-sm"
          name="nombreUsuario"
        />
      </label>

      <label className="space-y-2 text-sm font-medium">
        Telefono
        <input
          className="h-10 w-full rounded-md border bg-background px-3 text-sm"
          name="telefonoUsuario"
        />
      </label>

      <Button className="w-fit" type="submit">
        Aceptar invitacion
      </Button>
    </form>
  );
}
