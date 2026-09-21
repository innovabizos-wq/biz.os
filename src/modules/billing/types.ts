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
  barrio: string | null;
  canton: string | null;
  condicionVenta: string;
  correoEmisor: string | null;
  distrito: string | null;
  hasHaciendaPassword: boolean;
  hasHaciendaUsuario: boolean;
  hasP12: boolean;
  hasPin: boolean;
  identificacion: string | null;
  identificacionProveedorSistema: string | null;
  listoParaEmitir: boolean;
  medioPago: string;
  otrasSenas: string | null;
  provincia: string | null;
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
