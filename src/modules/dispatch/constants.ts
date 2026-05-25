export const DISPATCH_STATUSES = [
  "pendiente",
  "preparando",
  "listo",
  "en_ruta",
  "entregado",
  "fallido",
  "cancelado",
] as const;

export const DISPATCH_STATUS_FILTERS = ["todos", ...DISPATCH_STATUSES] as const;
export const DEFAULT_DISPATCH_STATUS_FILTER = "todos";
