import type { ModuleCode } from "@/types/core";

export type ModuleDefinition = {
  code: ModuleCode;
  name: string;
  order: number;
};

export const PLATFORM_MODULES: readonly ModuleDefinition[] = [
  { code: "admin", name: "Administracion", order: 10 },
  { code: "crm", name: "CRM", order: 20 },
  { code: "sales", name: "Ventas", order: 30 },
  { code: "inventory", name: "Inventario", order: 40 },
  { code: "billing", name: "Facturacion", order: 50 },
  { code: "dispatch", name: "Despacho", order: 60 },
  { code: "hr", name: "RRHH", order: 70 },
  { code: "reports", name: "Reportes", order: 80 },
  { code: "ai", name: "IA", order: 90 },
] as const;
