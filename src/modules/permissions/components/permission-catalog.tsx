import type { PermissionCatalogItem } from "@/modules/permissions/queries";

type PermissionCatalogProps = {
  permissions: PermissionCatalogItem[];
};

function groupPermission(permission: PermissionCatalogItem): string {
  return permission.moduloCodigo ?? permission.codigo.split(".")[0] ?? "otros";
}

export function PermissionCatalog({ permissions }: PermissionCatalogProps) {
  const grouped = permissions.reduce<Record<string, PermissionCatalogItem[]>>(
    (acc, permission) => {
      const group = groupPermission(permission);
      acc[group] = [...(acc[group] ?? []), permission];
      return acc;
    },
    {},
  );

  return (
    <div className="space-y-4">
      {Object.entries(grouped).map(([group, items]) => (
        <section className="rounded-lg border bg-background p-4" key={group}>
          <h3 className="text-sm font-semibold uppercase text-muted-foreground">
            {group}
          </h3>
          <ul className="mt-3 grid gap-2 md:grid-cols-2">
            {items.map((permission) => (
              <li className="rounded-md bg-muted p-3" key={permission.codigo}>
                <p className="font-mono text-xs">{permission.codigo}</p>
                <p className="mt-1 text-sm font-medium">{permission.nombre}</p>
                {permission.descripcion ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {permission.descripcion}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
