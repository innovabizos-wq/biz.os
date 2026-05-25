export function AgendaCalendarsPanel() {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <h3 className="font-semibold text-slate-950">Calendarios</h3>
      <div className="mt-3 space-y-3 text-sm text-slate-600">
        <div className="flex items-center gap-2">
          <span className="size-2 rounded-full bg-sky-400" />
          Seguimientos
        </div>
        <div className="flex items-center gap-2">
          <span className="size-2 rounded-full bg-violet-400" />
          Clientes
        </div>
        <div className="flex items-center gap-2">
          <span className="size-2 rounded-full bg-emerald-400" />
          Completados
        </div>
      </div>
    </section>
  );
}
