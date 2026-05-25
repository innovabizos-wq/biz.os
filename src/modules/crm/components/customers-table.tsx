import Link from "next/link";

import type { CrmCustomer } from "@/modules/crm/types";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type CustomersTableProps = {
  className?: string;
  customers: CrmCustomer[];
};

export function CustomersTable({ className, customers }: CustomersTableProps) {
  return (
    <div className={cn("overflow-auto rounded-lg border bg-background", className)}>
      <table className="w-full text-left text-sm">
        <thead className="sticky top-0 z-10 bg-muted text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-4 py-3">Nombre</th>
            <th className="px-4 py-3">Tipo</th>
            <th className="px-4 py-3">Estado</th>
            <th className="px-4 py-3">Telefono</th>
            <th className="px-4 py-3">WhatsApp</th>
            <th className="px-4 py-3">Correo</th>
            <th className="px-4 py-3">Asignado</th>
            <th className="px-4 py-3">Origen</th>
            <th className="px-4 py-3">Accion</th>
          </tr>
        </thead>
        <tbody>
          {customers.map((customer) => (
            <tr className="border-t" key={customer.id}>
              <td className="px-4 py-3 font-medium">{customer.nombre}</td>
              <td className="px-4 py-3">{customer.tipo}</td>
              <td className="px-4 py-3">{customer.estado}</td>
              <td className="px-4 py-3">{customer.telefono ?? "No disponible"}</td>
              <td className="px-4 py-3">{customer.whatsapp ?? "No disponible"}</td>
              <td className="px-4 py-3">{customer.correo ?? "No disponible"}</td>
              <td className="px-4 py-3">
                {customer.asignadoNombre ?? "Sin asignar"}
              </td>
              <td className="px-4 py-3">{customer.origen ?? "No disponible"}</td>
              <td className="px-4 py-3">
                <Link
                  className={buttonVariants({ size: "sm", variant: "outline" })}
                  href={`/crm/clientes/${customer.id}`}
                >
                  Ver
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
