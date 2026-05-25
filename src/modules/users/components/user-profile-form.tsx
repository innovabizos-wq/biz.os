import { updateUserAction } from "@/modules/users/actions";
import type { AccessibleUser } from "@/modules/users/queries";
import { Button } from "@/components/ui/button";

type UserProfileFormProps = {
  user: AccessibleUser;
};

export function UserProfileForm({ user }: UserProfileFormProps) {
  return (
    <form
      action={updateUserAction}
      className="grid gap-4 rounded-lg border bg-background p-5 shadow-sm"
    >
      <input name="profileId" type="hidden" value={user.id} />
      <div>
        <h3 className="text-base font-semibold">Datos del usuario</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          El correo no se edita desde esta fase.
        </p>
      </div>

      <label className="space-y-2 text-sm font-medium">
        Nombre
        <input
          className="h-10 w-full rounded-md border bg-background px-3 text-sm"
          defaultValue={user.nombre}
          name="nombre"
          required
        />
      </label>

      <label className="space-y-2 text-sm font-medium">
        Telefono
        <input
          className="h-10 w-full rounded-md border bg-background px-3 text-sm"
          defaultValue={user.telefono ?? ""}
          name="telefono"
        />
      </label>

      <Button className="w-fit" type="submit">
        Guardar usuario
      </Button>
    </form>
  );
}
