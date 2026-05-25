import { changeProductStatusAction } from "@/modules/catalog/actions";
import type { CatalogProduct } from "@/modules/catalog/types";
import { Button } from "@/components/ui/button";

type ProductStatusFormProps = {
  canEdit: boolean;
  product: CatalogProduct;
};

export function ProductStatusForm({ canEdit, product }: ProductStatusFormProps) {
  if (!canEdit) {
    return null;
  }

  const nextStatus = product.estado === "activo" ? "inactivo" : "activo";

  return (
    <form action={changeProductStatusAction}>
      <input name="productoId" type="hidden" value={product.id} />
      <input name="estado" type="hidden" value={nextStatus} />
      <Button
        type="submit"
        variant={nextStatus === "inactivo" ? "destructive" : "outline"}
      >
        {nextStatus === "inactivo" ? "Inactivar" : "Activar"}
      </Button>
    </form>
  );
}
