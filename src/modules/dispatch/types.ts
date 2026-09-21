export type DispatchStatus =
  | "pendiente"
  | "preparando"
  | "listo"
  | "en_ruta"
  | "entregado"
  | "fallido"
  | "cancelado";

export type DispatchOrder = {
  clienteId: string | null;
  clienteNombre: string | null;
  completadoAt: string | null;
  contactoEntrega: string | null;
  createdAt: string;
  direccionEntrega: string | null;
  estado: DispatchStatus;
  fechaProgramada: string | null;
  horaProgramada: string | null;
  id: string;
  notas: string | null;
  numero: string;
  responsableId: string | null;
  responsableNombre: string | null;
  resultado: string | null;
  telefonoEntrega: string | null;
  totalVenta: number | null;
  updatedAt: string;
  ventaId: string;
  ventaNumero: string | null;
};

export type DispatchEvidenceType = "photo" | "signature";

export type DispatchDeliveryEvidence = {
  accuracyMeters: number | null;
  capturedAt: string;
  createdAt: string;
  fileName: string | null;
  id: string;
  latitude: number | null;
  longitude: number | null;
  mimeType: string;
  receiverName: string | null;
  sizeBytes: number;
  type: DispatchEvidenceType;
};

export type DispatchMobileTargetStatus = "en_ruta" | "entregado" | "fallido";

export type DispatchMobileOperationResult = {
  dispatchId: string;
  dispatchNumber: string;
  dispatchStatus: DispatchStatus;
  evidenceCount: number;
};

export type DispatchAssignableUser = {
  id: string;
  nombre: string;
};

export type DispatchStatusFilter = DispatchStatus | "todos";
