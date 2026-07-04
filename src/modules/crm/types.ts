export type CrmClienteTipo = "prospecto" | "cliente";
export type CrmClienteGenero = "h" | "m" | "o";

export type CrmClienteEstado =
  | "nuevo"
  | "contactado"
  | "calificado"
  | "cotizado"
  | "ganado"
  | "perdido"
  | "inactivo";

export type CrmInteraccionTipo =
  | "nota"
  | "llamada"
  | "whatsapp"
  | "correo"
  | "reunion"
  | "sistema";

export type CrmSeguimientoEstado = "pendiente" | "completado" | "cancelado";

export type CrmCustomer = {
  asignadoA: string | null;
  asignadoNombre: string | null;
  correo: string | null;
  createdAt: string;
  empresaId: string;
  estado: CrmClienteEstado;
  followupsCount: number;
  genero: CrmClienteGenero;
  id: string;
  identificacion: string | null;
  interactionsCount: number;
  lastActivityAt: string | null;
  lastFollowupAt: string | null;
  lastInteractionAt: string | null;
  lastQuoteAt: string | null;
  lastSaleAt: string | null;
  nombre: string;
  notas: string | null;
  origen: string | null;
  pendingFollowupsCount: number;
  quotesCount: number;
  salesCount: number;
  telefono: string | null;
  tipo: CrmClienteTipo;
  updatedAt: string;
  whatsapp: string | null;
};

export type CrmInteraction = {
  createdAt: string;
  createdBy: string | null;
  createdByNombre: string | null;
  id: string;
  resultado: string | null;
  resumen: string;
  tipo: CrmInteraccionTipo;
};

export type CrmFollowup = {
  asignadoA: string | null;
  asignadoNombre: string | null;
  asunto: string;
  completadoAt: string | null;
  createdAt: string;
  descripcion: string | null;
  estado: CrmSeguimientoEstado;
  fechaProgramada: string;
  id: string;
};

export type CrmAssignableUser = {
  id: string;
  nombre: string;
};
