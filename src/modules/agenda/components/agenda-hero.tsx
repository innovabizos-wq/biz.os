import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";

type AgendaHeroProps = {
  totalToday: number;
};

export function AgendaHero({ totalToday }: AgendaHeroProps) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-sky-100 bg-gradient-to-br from-sky-100 via-white to-indigo-100 p-6 shadow-sm md:p-8">
      <div className="absolute right-8 top-6 hidden h-28 w-28 rounded-full bg-sky-200/40 blur-2xl md:block" />
      <div className="absolute bottom-0 right-32 hidden h-20 w-40 rounded-full bg-indigo-200/40 blur-2xl md:block" />
      <div className="relative flex flex-wrap items-start justify-between gap-6">
        <div className="max-w-2xl">
          <p className="text-sm font-medium text-sky-700">Agenda operativa</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
            Seguimientos claros para mover el día
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Da seguimiento a tareas comerciales, clientes pendientes y compromisos
            del equipo.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link className={buttonVariants()} href="/agenda/seguimientos">
              Ver todos los seguimientos
            </Link>
            <Link
              className={buttonVariants({ variant: "outline" })}
              href="/crm/clientes"
            >
              Ver clientes
            </Link>
          </div>
        </div>
        <div className="rounded-2xl border border-white/70 bg-white/80 p-5 text-slate-900 shadow-sm backdrop-blur">
          <p className="text-sm text-slate-500">Para hoy</p>
          <p className="mt-2 text-4xl font-semibold">{totalToday}</p>
          <p className="mt-1 text-sm text-slate-500">seguimientos pendientes</p>
        </div>
      </div>
    </div>
  );
}
