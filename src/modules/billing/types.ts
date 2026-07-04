export type FiscalEnvironment = "pruebas" | "produccion";

export type ElectronicInvoiceStatus =
  | "borrador"
  | "firmando"
  | "enviada"
  | "aceptada"
  | "rechazada"
  | "error";

export type FiscalConfiguration = {
  actividadEconomica: string | null;
  ambiente: FiscalEnvironment;
  correoEmisor: string | null;
  hasHaciendaPassword: boolean;
  hasHaciendaUsuario: boolean;
  hasP12: boolean;
  hasPin: boolean;
  identificacion: string | null;
  listoParaEmitir: boolean;
  razonSocial: string | null;
  sucursal: string;
  terminal: string;
  tipoIdentificacion: string;
};

export type ElectronicInvoice = {
  ambiente: FiscalEnvironment;
  clave: string | null;
  clienteId: string | null;
  estado: ElectronicInvoiceStatus;
  fiscalDocumentId: string | null;
  id: string;
  numero: string;
  totalComprobante: number;
  ventaId: string;
};
