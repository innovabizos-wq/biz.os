import Link from "next/link";

import type { CrmCustomer } from "@/modules/crm/types";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type CustomersTableProps = {
  className?: string;
  customers: CrmCustomer[];
};

function formatActivityDate(value: string | null) {
  return value ? new Date(value).toLocaleDateString("es") : "Sin actividad";
}

export function CustomersTable({ className, customers }: CustomersTableProps) {
  return (
    <div
      className={cn(
        "overflow-x-hidden overflow-y-auto rounded-xl border border-slate-200 bg-background",
        className,
      )}
    >
      <table className="w-full table-fixed text-left text-sm">
        <colgroup>
          <col className="w-[16%]" />
          <col className="w-[14%]" />
          <col className="w-[12%]" />
          <col className="w-[12%]" />
          <col className="w-[17%]" />
          <col className="w-[12%]" />
          <col className="w-[10%]" />
          <col className="w-[7%]" />
        </colgroup>
        <thead className="sticky top-0 z-10 border-b border-cyan-200/80 bg-gradient-to-r from-cyan-200/80 via-sky-50 to-amber-200/70 text-slate-700">
          <tr>
            <th className="crm-customers-heading whitespace-nowrap px-3 py-2">Nombre</th>
            <th className="crm-customers-heading whitespace-nowrap px-3 py-2">Identificación</th>
            <th className="crm-customers-heading whitespace-nowrap px-3 py-2">Teléfono</th>
            <th className="crm-customers-heading whitespace-nowrap px-3 py-2">WhatsApp</th>
            <th className="crm-customers-heading whitespace-nowrap px-3 py-2">Correo</th>
            <th className="crm-customers-heading whitespace-nowrap px-3 py-2">Último movimiento</th>
            <th className="crm-customers-heading whitespace-nowrap px-3 py-2">Asignado</th>
            <th className="crm-customers-heading whitespace-nowrap px-3 py-2 text-center">Acción</th>
          </tr>
        </thead>
        <tbody>
          {customers.map((customer) => (
            <tr
              className="border-t border-slate-100 transition-[background-color,box-shadow] duration-200 ease-out odd:bg-white even:bg-slate-50/60 hover:bg-cyan-100/80 hover:shadow-[inset_3px_0_0_#06b6d4]"
              key={customer.id}
            >
              <td className="break-words px-3 py-3 font-semibold text-slate-900">
                {customer.nombre}
              </td>
              <td className="break-all px-3 py-3">
                {customer.identificacion ?? "No disponible"}
              </td>
              <td className="break-all px-3 py-3">
                {customer.telefono ?? "No disponible"}
              </td>
              <td className="break-all px-3 py-3">
                {customer.whatsapp ?? "No disponible"}
              </td>
              <td className="break-words px-3 py-3">
                {customer.correo ?? "No disponible"}
              </td>
              <td className="break-words px-3 py-3">
                {formatActivityDate(customer.lastActivityAt)}
              </td>
              <td className="break-words px-3 py-3">
                {customer.asignadoNombre ?? "Sin asignar"}
              </td>
              <td className="px-2 py-3 text-center">
                <Link
                  className={cn(
                    buttonVariants({ size: "sm", variant: "outline" }),
                    "px-2",
                  )}
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
