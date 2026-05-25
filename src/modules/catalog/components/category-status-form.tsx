import { changeCategoryStatusAction } from "@/modules/catalog/actions";
import type { CatalogCategory } from "@/modules/catalog/types";
import { Button } from "@/components/ui/button";

type CategoryStatusFormProps = {
  canEdit: boolean;
  category: CatalogCategory;
};

export function CategoryStatusForm({
  canEdit,
  category,
}: CategoryStatusFormProps) {
  if (!canEdit) {
    return null;
  }

  const nextStatus = category.estado === "activa" ? "inactiva" : "activa";

  return (
    <form action={changeCategoryStatusAction}>
      <input name="categoriaId" type="hidden" value={category.id} />
      <input name="estado" type="hidden" value={nextStatus} />
      <Button
        size="sm"
        type="submit"
        variant={nextStatus === "inactiva" ? "destructive" : "outline"}
      >
        {nextStatus === "inactiva" ? "Inactivar" : "Activar"}
      </Button>
    </form>
  );
}
