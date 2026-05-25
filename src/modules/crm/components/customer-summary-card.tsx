import type { CrmCustomer } from "@/modules/crm/types";

type CustomerSummaryCardProps = {
  customer: CrmCustomer;
};

export function CustomerSummaryCard({ customer }: CustomerSummaryCardProps) {
  return (
    <div className="grid gap-4 md:grid-cols-4">
      <div className="rounded-lg border bg-background p-4">
        <p className="text-sm text-muted-foreground">Tipo</p>
        <p className="mt-1 font-medium">{customer.tipo}</p>
      </div>
      <div className="rounded-lg border bg-background p-4">
        <p className="text-sm text-muted-foreground">Estado</p>
        <p className="mt-1 font-medium">{customer.estado}</p>
      </div>
      <div className="rounded-lg border bg-background p-4">
        <p className="text-sm text-muted-foreground">Asignado</p>
        <p className="mt-1 font-medium">
          {customer.asignadoNombre ?? "Sin asignar"}
        </p>
      </div>
      <div className="rounded-lg border bg-background p-4">
        <p className="text-sm text-muted-foreground">Creacion</p>
        <p className="mt-1 font-medium">
          {new Date(customer.createdAt).toLocaleDateString("es")}
        </p>
      </div>
    </div>
  );
}
