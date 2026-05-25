import type { CrmSeguimientoEstado } from "@/modules/crm/types";

export type AgendaScope = "mios" | "todos";
export type AgendaEstadoFilter = CrmSeguimientoEstado | "todos";
export type AgendaRange = "hoy" | "vencidos" | "proximos7" | "todos";

export type AgendaFilters = {
  desde?: string;
  estado: AgendaEstadoFilter;
  hasta?: string;
  scope: AgendaScope;
};

export type AgendaFollowup = {
  asignadoA: string | null;
  asignadoNombre: string | null;
  asunto: string;
  clienteId: string;
  clienteNombre: string;
  clienteTelefono: string | null;
  clienteWhatsapp: string | null;
  createdAt: string;
  descripcion: string | null;
  estado: CrmSeguimientoEstado;
  fechaProgramada: string;
  seguimientoId: string;
};

export type AgendaSummary = {
  completadosRecientes: AgendaFollowup[];
  hoy: AgendaFollowup[];
  proximos: AgendaFollowup[];
  vencidos: AgendaFollowup[];
};

export type AgendaAssignableUser = {
  id: string;
  nombre: string;
};
