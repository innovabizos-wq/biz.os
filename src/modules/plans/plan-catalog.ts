import type { JsonRecord, PlanCode } from "@/types/core";

export type PlanDefinition = {
  code: PlanCode;
  limits: JsonRecord;
  name: string;
};

export const PLAN_CATALOG: readonly PlanDefinition[] = [
  { code: "starter", limits: { sucursales: 1, usuarios: 5 }, name: "Starter" },
  { code: "pro", limits: { sucursales: 5, usuarios: 25 }, name: "Pro" },
  {
    code: "enterprise",
    limits: { sucursales: null, usuarios: null },
    name: "Enterprise",
  },
] as const;
