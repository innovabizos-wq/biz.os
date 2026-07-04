import type { ModuleCode, PermissionCode } from "@/types/core";

export type ModuleKind = "core" | "optional";

export type ModuleHealthKey =
  | "configuration"
  | "credentials"
  | "last_error"
  | "last_success"
  | "webhook"
  | "external_api";

export type ModuleDefinition = {
  code: ModuleCode;
  name: string;
  description: string;
  kind: ModuleKind;
  order: number;
  routes: readonly string[];
  requiredPermissions: readonly PermissionCode[];
  requiredConfigKeys: readonly string[];
  healthKeys: readonly ModuleHealthKey[];
  softDependencies: readonly ModuleCode[];
};

export const PLATFORM_MODULES = [
  {
    code: "admin",
    description: "Nucleo administrativo, empresa, roles, permisos y modulos.",
    healthKeys: ["configuration"],
    kind: "core",
    name: "Administracion",
    order: 10,
    requiredConfigKeys: [],
    requiredPermissions: ["admin.settings.view"],
    routes: ["/admin"],
    softDependencies: [],
  },
  {
    code: "crm",
    description: "Clientes, prospectos, interacciones y seguimiento comercial.",
    healthKeys: ["configuration"],
    kind: "core",
    name: "CRM",
    order: 20,
    requiredConfigKeys: [],
    requiredPermissions: ["crm.customers.view"],
    routes: ["/crm", "/consultas/nueva"],
    softDependencies: [],
  },
  {
    code: "agenda",
    description: "Agenda comercial basada en seguimientos y compromisos.",
    healthKeys: ["configuration"],
    kind: "core",
    name: "Agenda",
    order: 25,
    requiredConfigKeys: [],
    requiredPermissions: ["crm.followups.view"],
    routes: ["/agenda"],
    softDependencies: ["crm"],
  },
  {
    code: "quotes",
    description: "Cotizaciones, items comerciales y conversion a venta.",
    healthKeys: ["configuration"],
    kind: "core",
    name: "Cotizaciones",
    order: 30,
    requiredConfigKeys: [],
    requiredPermissions: ["quotes.view"],
    routes: ["/cotizaciones"],
    softDependencies: ["crm", "catalog"],
  },
  {
    code: "catalog",
    description: "Catalogo comercial de productos, servicios y categorias.",
    healthKeys: ["configuration"],
    kind: "core",
    name: "Catalogo",
    order: 35,
    requiredConfigKeys: [],
    requiredPermissions: ["catalog.products.view"],
    routes: ["/catalogo"],
    softDependencies: [],
  },
  {
    code: "sales",
    description: "Ventas, ordenes y puente hacia inventario, despacho y cobro.",
    healthKeys: ["configuration"],
    kind: "core",
    name: "Ventas",
    order: 40,
    requiredConfigKeys: [],
    requiredPermissions: ["sales.orders.view"],
    routes: ["/ventas"],
    softDependencies: ["quotes", "inventory", "dispatch", "payments"],
  },
  {
    code: "inventory",
    description: "Bodegas, stock, movimientos, entradas y traslados.",
    healthKeys: ["configuration"],
    kind: "core",
    name: "Inventario",
    order: 50,
    requiredConfigKeys: [],
    requiredPermissions: ["inventory.stock.view"],
    routes: ["/inventario"],
    softDependencies: ["catalog", "purchases"],
  },
  {
    code: "dispatch",
    description: "Despacho, logistica, entregas y choferes en vivo.",
    healthKeys: ["configuration"],
    kind: "core",
    name: "Despacho",
    order: 60,
    requiredConfigKeys: [],
    requiredPermissions: ["dispatch.orders.view"],
    routes: ["/despacho"],
    softDependencies: ["sales", "mobile"],
  },
  {
    code: "hr",
    description: "Personal, planillas, estados laborales y dashboard RRHH.",
    healthKeys: ["configuration"],
    kind: "core",
    name: "RRHH",
    order: 70,
    requiredConfigKeys: [],
    requiredPermissions: ["hr.timesheets.view"],
    routes: ["/rrhh"],
    softDependencies: [],
  },
  {
    code: "billing",
    description: "Facturacion electronica Costa Rica: fiscal, CABYS, documentos, XML y Hacienda.",
    healthKeys: ["configuration", "credentials", "external_api", "last_error"],
    kind: "optional",
    name: "Facturacion",
    order: 80,
    requiredConfigKeys: ["fiscal"],
    requiredPermissions: ["billing.view", "billing.config.view"],
    routes: [
      "/facturacion",
      "/facturacion/documentos",
      "/facturacion/configuracion",
      "/facturacion/cabys",
      "/facturacion/consecutivos",
      "/facturacion/recepcion",
      "/facturacion/reportes",
      "/admin/fiscal",
    ],
    softDependencies: ["sales", "payments"],
  },
  {
    code: "whapp",
    description: "Operacion omnicanal Whapp sobre Inbox, webhooks, plantillas, campanas, automatizaciones y conversaciones.",
    healthKeys: ["configuration", "credentials", "webhook", "last_error"],
    kind: "optional",
    name: "Whapp",
    order: 90,
    requiredConfigKeys: ["meta_channels"],
    requiredPermissions: ["inbox.conversations.view", "inbox.channels.view"],
    routes: [
      "/whapp",
      "/whapp/plantillas",
      "/whapp/campanas",
      "/whapp/automatizaciones",
      "/inbox",
    ],
    softDependencies: ["crm"],
  },
  {
    code: "reports",
    description: "Dashboards, reportes operativos y analitica transversal.",
    healthKeys: ["configuration"],
    kind: "optional",
    name: "Reportes",
    order: 100,
    requiredConfigKeys: [],
    requiredPermissions: ["reports.dashboard.view"],
    routes: ["/dashboard"],
    softDependencies: ["crm", "sales", "inventory", "dispatch"],
  },
  {
    code: "autoblog",
    description: "Articulos, borradores, aprobacion y publicacion automatizable.",
    healthKeys: ["configuration", "credentials", "external_api", "last_error"],
    kind: "optional",
    name: "Autoblog",
    order: 110,
    requiredConfigKeys: ["business_context", "publishing_channels"],
    requiredPermissions: ["autoblog.view"],
    routes: ["/autoblog"],
    softDependencies: ["ai"],
  },
  {
    code: "ai",
    description: "Asistencia operativa, analisis y uso del contexto del negocio.",
    healthKeys: ["configuration", "credentials", "external_api", "last_error"],
    kind: "optional",
    name: "IA",
    order: 120,
    requiredConfigKeys: ["ai_provider"],
    requiredPermissions: ["ai.reports.use"],
    routes: ["/admin/ia"],
    softDependencies: [],
  },
  {
    code: "purchases",
    description: "Proveedores, ordenes de compra, recepcion y costos.",
    healthKeys: ["configuration"],
    kind: "optional",
    name: "Compras",
    order: 130,
    requiredConfigKeys: [],
    requiredPermissions: ["purchases.orders.view"],
    routes: ["/compras"],
    softDependencies: ["inventory", "payments"],
  },
  {
    code: "payments",
    description: "Pagos, cuentas por cobrar, saldos, abonos y vencimientos.",
    healthKeys: ["configuration"],
    kind: "optional",
    name: "Pagos",
    order: 140,
    requiredConfigKeys: [],
    requiredPermissions: ["payments.accounts.view"],
    routes: ["/pagos"],
    softDependencies: ["sales", "billing", "purchases"],
  },
  {
    code: "mobile",
    description: "Contratos de API para app movil, choferes y operacion ligera.",
    healthKeys: ["configuration", "external_api", "last_error"],
    kind: "optional",
    name: "App Movil",
    order: 150,
    requiredConfigKeys: ["mobile_api"],
    requiredPermissions: ["mobile.access"],
    routes: ["/api/mobile"],
    softDependencies: ["dispatch", "sales"],
  },
  {
    code: "brain",
    description: "Inteligencia transversal para metricas, insights y recomendaciones operativas.",
    healthKeys: ["configuration"],
    kind: "optional",
    name: "Business Brain",
    order: 160,
    requiredConfigKeys: ["business_context"],
    requiredPermissions: ["brain.insights.view"],
    routes: ["/brain", "/dashboard/direccion"],
    softDependencies: ["crm", "sales", "inventory", "payments", "agenda", "reports", "whapp"],
  },
] as const satisfies readonly ModuleDefinition[];

export const PLATFORM_MODULES_BY_CODE = Object.fromEntries(
  PLATFORM_MODULES.map((platformModule) => [
    platformModule.code,
    platformModule,
  ]),
) as unknown as Record<ModuleCode, ModuleDefinition>;

export function getModuleDefinition(moduleCode: ModuleCode) {
  return PLATFORM_MODULES_BY_CODE[moduleCode];
}

export function getModuleKind(moduleCode: ModuleCode): ModuleKind {
  return getModuleDefinition(moduleCode).kind;
}

export function isModuleLocked(moduleCode: ModuleCode): boolean {
  return getModuleKind(moduleCode) === "core";
}

export function getLockedModuleMessage(moduleCode: ModuleCode): string {
  const platformModule = getModuleDefinition(moduleCode);

  return `${platformModule.name} es un modulo madre de biz.os. Se mantiene siempre activo para proteger flujos, datos y permisos compartidos.`;
}
