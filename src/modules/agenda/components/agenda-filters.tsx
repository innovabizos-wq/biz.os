import type {
  AgendaEstadoFilter,
  AgendaRange,
  AgendaScope,
} from "@/modules/agenda/types";
import { Button } from "@/components/ui/button";

type AgendaFiltersProps = {
  estado: AgendaEstadoFilter;
  range: AgendaRange;
  scope: AgendaScope;
};

export function AgendaFilters({ estado, range, scope }: AgendaFiltersProps) {
  return (
    <form className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto]" method="get">
      <label className="space-y-1 text-sm">
        <span className="font-medium">Alcance</span>
        <select
          className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm shadow-sm"
          defaultValue={scope}
          name="scope"
        >
          <option value="mios">Mis seguimientos</option>
          <option value="todos">Todos</option>
        </select>
      </label>
      <label className="space-y-1 text-sm">
        <span className="font-medium">Estado</span>
        <select
          className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm shadow-sm"
          defaultValue={estado}
          name="estado"
        >
          <option value="pendiente">Pendiente</option>
          <option value="completado">Completado</option>
          <option value="cancelado">Cancelado</option>
          <option value="todos">Todos</option>
        </select>
      </label>
      <label className="space-y-1 text-sm">
        <span className="font-medium">Rango</span>
        <select
          className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm shadow-sm"
          defaultValue={range}
          name="range"
        >
          <option value="hoy">Hoy</option>
          <option value="vencidos">Vencidos</option>
          <option value="proximos7">Próximos 7 días</option>
          <option value="todos">Todos</option>
        </select>
      </label>
      <div className="flex items-end">
        <Button className="w-full md:w-auto" type="submit">
          Filtrar
        </Button>
      </div>
    </form>
  );
}
