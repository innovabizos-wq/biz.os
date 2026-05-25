import type { PermissionCode } from "@/types/core";

type CurrentPermissionsSummaryProps = {
  permissions: readonly PermissionCode[];
};

export function CurrentPermissionsSummary({
  permissions,
}: CurrentPermissionsSummaryProps) {
  return (
    <section className="rounded-lg border bg-background p-5 shadow-sm">
      <h3 className="text-base font-semibold">Permisos del usuario actual</h3>
      <p className="mt-2 text-sm text-muted-foreground">
        Estos permisos provienen del rol visible para el usuario autenticado.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {permissions.map((permission) => (
          <span
            className="rounded-md bg-muted px-2.5 py-1 font-mono text-xs"
            key={permission}
          >
            {permission}
          </span>
        ))}
      </div>
    </section>
  );
}
