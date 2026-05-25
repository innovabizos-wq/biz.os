import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { DispatchOrder } from "@/modules/dispatch/types";

type DispatchTableProps = {
  className?: string;
  dispatches: DispatchOrder[];
};

export function DispatchTable({ className, dispatches }: DispatchTableProps) {
  return (
    <div className={cn("overflow-auto rounded-lg border bg-background", className)}>
      <table className="w-full text-left text-sm">
        <thead className="sticky top-0 z-10 bg-muted text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-4 py-3">Numero</th>
            <th className="px-4 py-3">Cliente</th>
            <th className="px-4 py-3">Venta</th>
            <th className="px-4 py-3">Estado</th>
            <th className="px-4 py-3">Fecha</th>
            <th className="px-4 py-3">Responsable</th>
            <th className="px-4 py-3">Contacto</th>
            <th className="px-4 py-3">Telefono</th>
            <th className="px-4 py-3">Accion</th>
          </tr>
        </thead>
        <tbody>
          {dispatches.map((dispatch) => (
            <tr className="border-t" key={dispatch.id}>
              <td className="px-4 py-3 font-medium">{dispatch.numero}</td>
              <td className="px-4 py-3">
                {dispatch.clienteNombre ?? "Sin cliente"}
              </td>
              <td className="px-4 py-3">{dispatch.ventaNumero ?? "Venta"}</td>
              <td className="px-4 py-3">{dispatch.estado}</td>
              <td className="px-4 py-3">
                {dispatch.fechaProgramada ?? "Sin programar"}
              </td>
              <td className="px-4 py-3">
                {dispatch.responsableNombre ?? "Sin responsable"}
              </td>
              <td className="px-4 py-3">{dispatch.contactoEntrega ?? "-"}</td>
              <td className="px-4 py-3">{dispatch.telefonoEntrega ?? "-"}</td>
              <td className="px-4 py-3">
                <Link
                  className={buttonVariants({ size: "sm", variant: "outline" })}
                  href={`/despacho/${dispatch.id}`}
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
