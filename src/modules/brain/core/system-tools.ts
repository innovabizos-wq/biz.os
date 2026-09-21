import { z } from "zod";

import type { BrainToolDefinition } from "@/modules/brain/core/contracts";
import { ok } from "@/types/core";

const emptyInputSchema = z.object({}).strict();
const timestampOutputSchema = z.object({
  iso: z.string(),
  locale: z.string(),
  timezone: z.string(),
});

function now() {
  return new Date();
}

export function createBrainSystemTools(): BrainToolDefinition[] {
  return [
    {
      category: "system",
      description: "Responde pong para validar que el Tool Engine esta activo.",
      enabled: true,
      id: "system.ping",
      inputSchema: emptyInputSchema,
      module: "brain",
      name: "Ping",
      outputSchema: z.object({ message: z.literal("pong") }),
      requiredPermissions: ["brain.insights.view"],
      version: "1.0.0",
      async execute() {
        return ok({ data: { message: "pong" } });
      },
    },
    {
      category: "system",
      description: "Devuelve la fecha actual del servidor.",
      enabled: true,
      id: "system.current_date",
      inputSchema: emptyInputSchema,
      module: "brain",
      name: "Fecha actual",
      outputSchema: timestampOutputSchema,
      requiredPermissions: ["brain.insights.view"],
      version: "1.0.0",
      async execute() {
        const value = now();
        return ok({
          data: {
            iso: value.toISOString(),
            locale: value.toLocaleDateString("es-CR"),
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          },
        });
      },
    },
    {
      category: "system",
      description: "Devuelve la hora actual del servidor.",
      enabled: true,
      id: "system.current_time",
      inputSchema: emptyInputSchema,
      module: "brain",
      name: "Hora actual",
      outputSchema: timestampOutputSchema,
      requiredPermissions: ["brain.insights.view"],
      version: "1.0.0",
      async execute() {
        const value = now();
        return ok({
          data: {
            iso: value.toISOString(),
            locale: value.toLocaleTimeString("es-CR"),
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          },
        });
      },
    },
    {
      category: "system",
      description: "Devuelve informacion del usuario autenticado en el TenantContext.",
      enabled: true,
      id: "system.current_user",
      inputSchema: emptyInputSchema,
      module: "brain",
      name: "Usuario autenticado",
      outputSchema: z.object({
        email: z.string().nullable(),
        id: z.string(),
        name: z.string().nullable(),
        roleId: z.string().nullable(),
      }),
      requiredPermissions: ["brain.insights.view"],
      version: "1.0.0",
      async execute(input) {
        return ok({
          data: {
            email: input.tenant.profileEmail ?? null,
            id: input.tenant.profileId,
            name: input.tenant.profileName ?? null,
            roleId: input.tenant.rolId ?? null,
          },
        });
      },
    },
    {
      category: "system",
      description: "Devuelve informacion de la empresa activa en el TenantContext.",
      enabled: true,
      id: "system.current_company",
      inputSchema: emptyInputSchema,
      module: "brain",
      name: "Empresa actual",
      outputSchema: z.object({
        activeModules: z.array(z.string()),
        id: z.string(),
        planCode: z.string().nullable(),
        sucursalId: z.string().nullable(),
      }),
      requiredPermissions: ["brain.insights.view"],
      version: "1.0.0",
      async execute(input) {
        return ok({
          data: {
            activeModules: input.tenant.activeModules,
            id: input.tenant.empresaId,
            planCode: input.tenant.planCode ?? null,
            sucursalId: input.tenant.sucursalId ?? null,
          },
        });
      },
    },
    {
      category: "system",
      description: "Devuelve informacion basica del runtime del Tool Engine.",
      enabled: true,
      id: "system.basic_info",
      inputSchema: emptyInputSchema,
      module: "brain",
      name: "Informacion basica del sistema",
      outputSchema: z.object({
        engine: z.literal("brain-tool-engine"),
        nodeEnv: z.string(),
        version: z.string(),
      }),
      requiredPermissions: ["brain.insights.view"],
      version: "1.0.0",
      async execute() {
        return ok({
          data: {
            engine: "brain-tool-engine",
            nodeEnv: process.env.NODE_ENV ?? "development",
            version: "1.0.0",
          },
        });
      },
    },
  ];
}
