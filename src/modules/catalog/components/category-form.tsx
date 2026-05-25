import {
  createCategoryAction,
  updateCategoryAction,
} from "@/modules/catalog/actions";
import type { CatalogCategory } from "@/modules/catalog/types";
import { Button } from "@/components/ui/button";

type CategoryFormProps = {
  category?: CatalogCategory;
  mode: "create" | "update";
};

export function CategoryForm({ category, mode }: CategoryFormProps) {
  const action = mode === "create" ? createCategoryAction : updateCategoryAction;

  return (
    <form action={action} className="space-y-3 rounded-lg border bg-background p-4">
      {category ? (
        <input name="categoriaId" type="hidden" value={category.id} />
      ) : null}
      <label className="space-y-1 text-sm">
        <span className="font-medium">Nombre</span>
        <input
          className="h-9 w-full rounded-md border bg-background px-3 text-sm"
          defaultValue={category?.nombre ?? ""}
          name="nombre"
          required
        />
      </label>
      <label className="space-y-1 text-sm">
        <span className="font-medium">Descripcion</span>
        <textarea
          className="min-h-20 w-full rounded-md border bg-background px-3 py-2 text-sm"
          defaultValue={category?.descripcion ?? ""}
          name="descripcion"
        />
      </label>
      <Button size="sm" type="submit">
        {mode === "create" ? "Crear categoria" : "Guardar"}
      </Button>
    </form>
  );
}
