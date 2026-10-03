"use client";

import { useState } from "react";
import { FilePlus2 } from "lucide-react";

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
import { createInteractionAction } from "@/modules/crm/actions";
import { CRM_INTERACCION_TIPOS } from "@/modules/crm/constants";
import { cn } from "@/lib/utils";

type InteractionFormProps = {
  buttonClassName?: string;
  buttonLabel?: string;
  clienteId: string;
};

const interactionTypeLabels: Record<(typeof CRM_INTERACCION_TIPOS)[number], string> = {
  correo: "Correo",
  llamada: "Llamada",
  nota: "Nota",
  reunion: "Reunión",
  sistema: "Sistema",
  whatsapp: "WhatsApp",
};

export function InteractionForm({
  buttonClassName,
  buttonLabel = "Nueva interacción",
  clienteId,
}: InteractionFormProps) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <Button
        aria-haspopup="dialog"
        className={cn(buttonClassName)}
        onClick={() => setOpen(true)}
        size="sm"
        type="button"
        variant="outline"
      >
        <FilePlus2 aria-hidden={true} />
        {buttonLabel}
      </Button>
      <DialogContent className="max-w-lg rounded-[26px] p-0">
        <DialogHeader className="border-b border-slate-200 px-6 py-5">
          <DialogTitle className="text-xl font-black text-slate-950">
            Registrar interacción
          </DialogTitle>
          <DialogDescription>
            Guarda una nota, llamada o conversación importante para este cliente.
          </DialogDescription>
        </DialogHeader>

        <form action={createInteractionAction} className="grid gap-4 px-6 py-5">
          <input name="clienteId" type="hidden" value={clienteId} />
          <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
            Tipo de interacción
            <select
              className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
              defaultValue="nota"
              name="tipo"
              required
            >
              {CRM_INTERACCION_TIPOS.map((tipo) => (
                <option key={tipo} value={tipo}>
                  {interactionTypeLabels[tipo]}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
            Resultado o detalle breve
            <input
              className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal outline-none placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
              name="resultado"
              placeholder="Ej. Solicitó una cotización"
            />
          </label>

          <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
            ¿Qué ocurrió?
            <textarea
              className="min-h-28 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-normal outline-none placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
              name="resumen"
              placeholder="Escribe la información que quieras conservar en el historial."
              required
            />
          </label>

          <DialogFooter className="-mx-6 -mb-5 border-t border-slate-200 bg-slate-50 px-6 py-4">
            <DialogClose render={<Button type="button" variant="outline" />}>
              Cancelar
            </DialogClose>
            <Button type="submit">Guardar interacción</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
