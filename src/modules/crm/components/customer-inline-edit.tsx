"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { updateCustomerAction } from "@/modules/crm/actions";
import {
  CRM_CLIENTE_ESTADOS,
  CRM_CLIENTE_TIPOS,
} from "@/modules/crm/constants";
import type { CrmAssignableUser, CrmCustomer } from "@/modules/crm/types";
import { cn } from "@/lib/utils";

type EditableField =
  | "nombre"
  | "tipo"
  | "estado"
  | "telefono"
  | "whatsapp"
  | "correo"
  | "documento"
  | "asignadoA"
  | "origen"
  | "notas";

type CustomerInlineEditProps = {
  assignableUsers: CrmAssignableUser[];
  customer: CrmCustomer;
  field: EditableField;
  label: string;
  triggerClassName?: string;
};

const fieldTitles: Record<EditableField, string> = {
  asignadoA: "responsable",
  correo: "correo",
  documento: "documento",
  estado: "estado",
  nombre: "nombre",
  notas: "nota visible",
  origen: "origen",
  telefono: "teléfono",
  tipo: "tipo de cliente",
  whatsapp: "WhatsApp",
};

function HiddenCustomerFields({ customer }: { customer: CrmCustomer }) {
  return (
    <>
      <input name="clienteId" type="hidden" value={customer.id} />
      <input name="tipo" type="hidden" value={customer.tipo} />
      <input name="estado" type="hidden" value={customer.estado} />
      <input name="genero" type="hidden" value={customer.genero} />
      <input name="asignadoA" type="hidden" value={customer.asignadoA ?? ""} />
      <input name="correo" type="hidden" value={customer.correo ?? ""} />
      <input
        name="fiscalIdentificationType"
        type="hidden"
        value={customer.fiscalIdentificationType ?? ""}
      />
      <input name="identificacion" type="hidden" value={customer.identificacion ?? ""} />
      <input name="nombre" type="hidden" value={customer.nombre} />
      <input name="notas" type="hidden" value={customer.notas ?? ""} />
      <input name="origen" type="hidden" value={customer.origen ?? ""} />
      <input name="telefono" type="hidden" value={customer.telefono ?? ""} />
      <input name="whatsapp" type="hidden" value={customer.whatsapp ?? ""} />
    </>
  );
}

function FieldControl({
  assignableUsers,
  customer,
  field,
}: Omit<CustomerInlineEditProps, "label">) {
  const inputClassName =
    "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200";

  if (field === "tipo") {
    return (
      <select className={inputClassName} defaultValue={customer.tipo} name="tipo">
        {CRM_CLIENTE_TIPOS.map((tipo) => (
          <option key={tipo} value={tipo}>
            {tipo === "cliente" ? "Cliente" : "Prospecto"}
          </option>
        ))}
      </select>
    );
  }

  if (field === "estado") {
    return (
      <select className={inputClassName} defaultValue={customer.estado} name="estado">
        {CRM_CLIENTE_ESTADOS.map((estado) => (
          <option key={estado} value={estado}>
            {estado}
          </option>
        ))}
      </select>
    );
  }

  if (field === "asignadoA") {
    return (
      <select
        className={inputClassName}
        defaultValue={customer.asignadoA ?? ""}
        name="asignadoA"
      >
        <option value="">Sin asignar</option>
        {assignableUsers.map((user) => (
          <option key={user.id} value={user.id}>
            {user.nombre}
          </option>
        ))}
      </select>
    );
  }

  if (field === "documento") {
    return (
      <div className="grid gap-3 sm:grid-cols-[1fr_1.35fr]">
        <label className="grid gap-1.5 text-xs font-semibold text-slate-600">
          Tipo de documento
          <select
            className={inputClassName}
            defaultValue={customer.fiscalIdentificationType ?? ""}
            name="fiscalIdentificationType"
          >
            <option value="">Sin documento</option>
            <option value="01">Cédula física</option>
            <option value="02">Cédula jurídica</option>
            <option value="03">DIMEX</option>
            <option value="04">NITE</option>
          </select>
        </label>
        <label className="grid gap-1.5 text-xs font-semibold text-slate-600">
          Número
          <input
            className={inputClassName}
            defaultValue={customer.identificacion ?? ""}
            name="identificacion"
            placeholder="Número de identificación"
          />
        </label>
      </div>
    );
  }

  if (field === "notas") {
    return (
      <textarea
        className="min-h-28 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
        defaultValue={customer.notas ?? ""}
        name="notas"
        placeholder="Añade una nota visible para el equipo."
      />
    );
  }

  return (
    <input
      className={inputClassName}
      defaultValue={customer[field] ?? ""}
      name={field}
      type={field === "correo" ? "email" : "text"}
    />
  );
}

export function CustomerInlineEdit({
  assignableUsers,
  customer,
  field,
  label,
  triggerClassName,
}: CustomerInlineEditProps) {
  const [open, setOpen] = useState(false);
  const title = fieldTitles[field];

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <Button
        aria-label={`Editar ${label}`}
        className={cn(
          "absolute right-3 top-3 size-7 rounded-full text-slate-500 opacity-0 transition-opacity hover:bg-slate-100 hover:text-slate-900 focus-visible:opacity-100 group-hover:opacity-100",
          triggerClassName,
        )}
        onClick={() => setOpen(true)}
        size="icon"
        type="button"
        variant="ghost"
      >
        <Pencil aria-hidden={true} size={14} />
      </Button>

      <DialogContent className="max-w-md rounded-[24px] p-0">
        <DialogHeader className="border-b border-slate-200 px-6 py-5">
          <DialogTitle className="text-xl font-black text-slate-950">
            Editar {title}
          </DialogTitle>
          <DialogDescription>
            Actualiza este dato sin abrir un formulario largo.
          </DialogDescription>
        </DialogHeader>

        <form action={updateCustomerAction} className="grid gap-4 px-6 py-5">
          <HiddenCustomerFields customer={customer} />
          <FieldControl
            assignableUsers={assignableUsers}
            customer={customer}
            field={field}
          />
          <DialogFooter className="-mx-6 -mb-5 border-t border-slate-200 bg-slate-50 px-6 py-4">
            <DialogClose render={<Button type="button" variant="outline" />}>
              Cancelar
            </DialogClose>
            <Button type="submit">Guardar cambio</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
