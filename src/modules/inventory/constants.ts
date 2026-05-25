export const INVENTORY_WAREHOUSE_STATUSES = ["activa", "inactiva"] as const;
export const INVENTORY_MOVEMENT_TYPES = ["entrada", "salida", "ajuste"] as const;
export const INVENTORY_MOVEMENT_TYPE_FILTERS = [
  "todos",
  ...INVENTORY_MOVEMENT_TYPES,
] as const;
export const DEFAULT_INVENTORY_MOVEMENT_TYPE_FILTER = "todos";
