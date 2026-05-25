import { CategoryForm } from "@/modules/catalog/components/category-form";
import { CategoryStatusForm } from "@/modules/catalog/components/category-status-form";
import type { CatalogCategory } from "@/modules/catalog/types";

type CategoriesTableProps = {
  canEdit: boolean;
  categories: CatalogCategory[];
};

export function CategoriesTable({ canEdit, categories }: CategoriesTableProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {categories.map((category) => (
        <article className="space-y-3 rounded-lg border bg-background p-4" key={category.id}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-medium">{category.nombre}</p>
              <p className="mt-1 text-sm text-muted-foreground">{category.estado}</p>
            </div>
            <CategoryStatusForm canEdit={canEdit} category={category} />
          </div>
          {canEdit ? (
            <CategoryForm category={category} mode="update" />
          ) : (
            <p className="text-sm text-muted-foreground">
              {category.descripcion ?? "Sin descripcion"}
            </p>
          )}
        </article>
      ))}
    </div>
  );
}
