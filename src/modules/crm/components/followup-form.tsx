"use client";

import { useState } from "react";
import { CalendarPlus } from "lucide-react";

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
import { createFollowupAction } from "@/modules/crm/actions";
import type { CrmAssignableUser } from "@/modules/crm/types";
import { cn } from "@/lib/utils";

type FollowupFormProps = {
  assignableUsers: CrmAssignableUser[];
  buttonClassName?: string;
  buttonLabel?: string;
  clienteId: string;
};

export function FollowupForm({
  assignableUsers,
  buttonClassName,
  buttonLabel = "Nuevo seguimiento",
  clienteId,
}: FollowupFormProps) {
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
        <CalendarPlus aria-hidden={true} />
        {buttonLabel}
      </Button>
      <DialogContent className="max-w-lg rounded-[26px] p-0">
        <DialogHeader className="border-b border-slate-200 px-6 py-5">
          <DialogTitle className="text-xl font-black text-slate-950">
            Agendar seguimiento
          </DialogTitle>
          <DialogDescription>
            Programa el próximo paso para no dejar oportunidades pendientes.
          </DialogDescription>
        </DialogHeader>

        <form action={createFollowupAction} className="grid gap-4 px-6 py-5">
          <input name="clienteId" type="hidden" value={clienteId} />
          <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
            Asunto
            <input
              className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal outline-none placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
              name="asunto"
              placeholder="Ej. Dar seguimiento a la cotización"
              required
            />
          </label>

          <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
            Fecha y hora
            <input
              className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
              name="fechaProgramada"
              required
              type="datetime-local"
            />
          </label>

          <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
            Responsable
            <select
              className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
              name="asignadoA"
            >
              <option value="">Sin responsable asignado</option>
              {assignableUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.nombre}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
            Nota opcional
            <textarea
              className="min-h-24 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-normal outline-none placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
              name="descripcion"
              placeholder="Agrega contexto para la próxima acción."
            />
          </label>

          <DialogFooter className="-mx-6 -mb-5 border-t border-slate-200 bg-slate-50 px-6 py-4">
            <DialogClose render={<Button type="button" variant="outline" />}>
              Cancelar
            </DialogClose>
            <Button type="submit">Guardar seguimiento</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
