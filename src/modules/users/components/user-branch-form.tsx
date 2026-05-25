import { changeUserBranchAction } from "@/modules/users/actions";
import type { AccessibleUser } from "@/modules/users/queries";
import type { Sucursal } from "@/types/core";
import { Button } from "@/components/ui/button";

type UserBranchFormProps = {
  branches: Sucursal[];
  user: AccessibleUser;
};

export function UserBranchForm({ branches, user }: UserBranchFormProps) {
  return (
    <form
      action={changeUserBranchAction}
      className="grid gap-4 rounded-lg border bg-background p-5 shadow-sm"
    >
      <input name="profileId" type="hidden" value={user.id} />
      <div>
        <h3 className="text-base font-semibold">Sucursal</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          La sucursal debe pertenecer a la empresa actual.
        </p>
      </div>

      <label className="space-y-2 text-sm font-medium">
        Sucursal asignada
        <select
          className="h-10 w-full rounded-md border bg-background px-3 text-sm"
          defaultValue={user.sucursalId ?? ""}
          name="sucursalId"
        >
          <option value="">Sin sucursal</option>
          {branches.map((branch) => (
            <option key={branch.id} value={branch.id}>
              {branch.nombre}
            </option>
          ))}
        </select>
      </label>

      <Button className="w-fit" type="submit">
        Cambiar sucursal
      </Button>
    </form>
  );
}
