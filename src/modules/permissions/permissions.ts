import type { ModuleCode, PermissionCode } from "@/types/core";

export type PermissionDefinition = {
  code: PermissionCode;
  moduleCode: ModuleCode | null;
  name: string;
};

export const PERMISSIONS: readonly PermissionDefinition[] = [
  { code: "admin.users.view", moduleCode: "admin", name: "Ver usuarios" },
  { code: "admin.users.manage", moduleCode: "admin", name: "Gestionar usuarios" },
  { code: "admin.roles.view", moduleCode: "admin", name: "Ver roles" },
  { code: "admin.roles.manage", moduleCode: "admin", name: "Gestionar roles" },
  { code: "admin.settings.view", moduleCode: "admin", name: "Ver configuracion" },
  {
    code: "admin.settings.manage",
    moduleCode: "admin",
    name: "Gestionar configuracion",
  },
  { code: "crm.customers.view", moduleCode: "crm", name: "Ver clientes" },
  { code: "crm.customers.create", moduleCode: "crm", name: "Crear clientes" },
  { code: "crm.customers.edit", moduleCode: "crm", name: "Editar clientes" },
  {
    code: "crm.interactions.view",
    moduleCode: "crm",
    name: "Ver interacciones",
  },
  {
    code: "crm.interactions.create",
    moduleCode: "crm",
    name: "Crear interacciones",
  },
  {
    code: "crm.followups.view",
    moduleCode: "crm",
    name: "Ver seguimientos",
  },
  {
    code: "crm.followups.create",
    moduleCode: "crm",
    name: "Crear seguimientos",
  },
  {
    code: "crm.followups.edit",
    moduleCode: "crm",
    name: "Editar seguimientos",
  },
  { code: "quotes.view", moduleCode: "crm", name: "Ver cotizaciones" },
  { code: "quotes.create", moduleCode: "crm", name: "Crear cotizaciones" },
  { code: "quotes.edit", moduleCode: "crm", name: "Editar cotizaciones" },
  {
    code: "quotes.status.change",
    moduleCode: "crm",
    name: "Cambiar estado de cotizaciones",
  },
  {
    code: "catalog.products.view",
    moduleCode: null,
    name: "Ver productos y servicios",
  },
  {
    code: "catalog.products.create",
    moduleCode: null,
    name: "Crear productos y servicios",
  },
  {
    code: "catalog.products.edit",
    moduleCode: null,
    name: "Editar productos y servicios",
  },
  {
    code: "catalog.categories.view",
    moduleCode: null,
    name: "Ver categorias de catalogo",
  },
  {
    code: "catalog.categories.create",
    moduleCode: null,
    name: "Crear categorias de catalogo",
  },
  {
    code: "catalog.categories.edit",
    moduleCode: null,
    name: "Editar categorias de catalogo",
  },
  { code: "sales.orders.view", moduleCode: "sales", name: "Ver ventas" },
  { code: "sales.orders.create", moduleCode: "sales", name: "Crear ventas" },
  { code: "sales.orders.edit", moduleCode: "sales", name: "Editar ventas" },
  {
    code: "sales.orders.status.change",
    moduleCode: "sales",
    name: "Cambiar estado de ventas",
  },
  { code: "sales.quotes.view", moduleCode: "sales", name: "Ver cotizaciones" },
  { code: "sales.quotes.create", moduleCode: "sales", name: "Crear cotizaciones" },
  {
    code: "inventory.products.view",
    moduleCode: "inventory",
    name: "Ver productos",
  },
  {
    code: "inventory.stock.view",
    moduleCode: "inventory",
    name: "Ver stock",
  },
  {
    code: "inventory.stock.adjust",
    moduleCode: "inventory",
    name: "Ajustar stock",
  },
  {
    code: "inventory.movements.view",
    moduleCode: "inventory",
    name: "Ver movimientos de inventario",
  },
  {
    code: "inventory.warehouses.view",
    moduleCode: "inventory",
    name: "Ver bodegas",
  },
  {
    code: "inventory.warehouses.manage",
    moduleCode: "inventory",
    name: "Gestionar bodegas",
  },
  { code: "dispatch.orders.view", moduleCode: "dispatch", name: "Ver despachos" },
  {
    code: "dispatch.orders.create",
    moduleCode: "dispatch",
    name: "Crear despachos",
  },
  {
    code: "dispatch.orders.edit",
    moduleCode: "dispatch",
    name: "Editar despachos",
  },
  {
    code: "dispatch.orders.status.change",
    moduleCode: "dispatch",
    name: "Cambiar estado de despachos",
  },
  {
    code: "inbox.conversations.view",
    moduleCode: null,
    name: "Ver conversaciones de inbox",
  },
  {
    code: "inbox.conversations.create",
    moduleCode: null,
    name: "Crear conversaciones de inbox",
  },
  {
    code: "inbox.conversations.reply",
    moduleCode: null,
    name: "Responder conversaciones de inbox",
  },
  {
    code: "inbox.conversations.assign",
    moduleCode: null,
    name: "Asignar conversaciones de inbox",
  },
  {
    code: "inbox.conversations.status.change",
    moduleCode: null,
    name: "Cambiar estado de conversaciones de inbox",
  },
  {
    code: "inbox.channels.view",
    moduleCode: null,
    name: "Ver canales de inbox",
  },
  {
    code: "inbox.channels.manage",
    moduleCode: null,
    name: "Gestionar canales de inbox",
  },
  {
    code: "driver.tracking.use",
    moduleCode: "dispatch",
    name: "Usar seguimiento de chofer",
  },
  {
    code: "driver.tracking.view",
    moduleCode: "dispatch",
    name: "Ver ubicación de choferes",
  },
  {
    code: "driver.tracking.manage",
    moduleCode: "dispatch",
    name: "Administrar seguimiento de choferes",
  },
  {
    code: "reports.dashboard.view",
    moduleCode: "reports",
    name: "Ver dashboards",
  },
  { code: "ai.reports.use", moduleCode: "ai", name: "Usar reportes IA" },
] as const;
