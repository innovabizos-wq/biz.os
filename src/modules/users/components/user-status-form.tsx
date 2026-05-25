import { PROFILE_ESTADOS } from "@/modules/users/constants";
import { changeUserStatusAction } from "@/modules/users/actions";
import type { AccessibleUser } from "@/modules/users/queries";
import { Button } from "@/components/ui/button";

type UserStatusFormProps = {
  user: AccessibleUser;
};

export function UserStatusForm({ user }: UserStatusFormProps) {
  return (
    <form
      action={changeUserStatusAction}
      className="grid gap-4 rounded-lg border bg-background p-5 shadow-sm"
    >
      <input name="profileId" type="hidden" value={user.id} />
      <div>
        <h3 className="text-base font-semibold">Estado</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          No se borra fisicamente al usuario ni su cuenta de Supabase Auth.
        </p>
      </div>

      <label className="space-y-2 text-sm font-medium">
        Estado del usuario
        <select
          className="h-10 w-full rounded-md border bg-background px-3 text-sm"
          defaultValue={user.estado}
          name="estado"
          required
        >
          {PROFILE_ESTADOS.map((estado) => (
            <option key={estado} value={estado}>
              {estado}
            </option>
          ))}
        </select>
      </label>

      <Button className="w-fit" type="submit">
        Cambiar estado
      </Button>
    </form>
  );
}
