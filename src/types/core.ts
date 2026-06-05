export type CoreErrorCode =
  | "AUTH_NOT_CONNECTED"
  | "INVALID_TENANT_CONTEXT"
  | "MODULE_INACTIVE"
  | "MODULE_MISCONFIGURED"
  | "INTEGRATION_UNHEALTHY"
  | "PLAN_INACTIVE"
  | "PLAN_FEATURE_UNAVAILABLE"
  | "PERMISSION_DENIED"
  | "VALIDATION_ERROR";

export type CoreError = {
  code: CoreErrorCode;
  message: string;
  cause?: unknown;
};

export type CoreResult<T> =
  | {
      data: T;
      error: null;
      ok: true;
    }
  | {
      data: null;
      error: CoreError;
      ok: false;
    };

export function createCoreError(
  code: CoreErrorCode,
  message: string,
  cause?: unknown,
): CoreError {
  return { cause, code, message };
}

export function ok<T>(data: T): CoreResult<T> {
  return { data, error: null, ok: true };
}

export function fail<T = never>(
  code: CoreErrorCode,
  message: string,
  cause?: unknown,
): CoreResult<T> {
  return { data: null, error: createCoreError(code, message, cause), ok: false };
}

export type EmpresaEstado = "activa" | "inactiva" | "suspendida";
export type SucursalEstado = "activa" | "inactiva";
export type ProfileEstado = "activo" | "inactivo" | "suspendido";
export type RolEstado = "activo" | "inactivo";
export type CatalogEstado = "activo" | "inactivo";
export type EmpresaPlanEstado =
  | "activo"
  | "inactivo"
  | "cancelado"
  | "vencido";

export type ModuleCode =
  | "admin"
  | "crm"
  | "quotes"
  | "catalog"
  | "sales"
  | "inventory"
  | "billing"
  | "dispatch"
  | "hr"
  | "agenda"
  | "whapp"
  | "reports"
  | "ai"
  | "autoblog"
  | "purchases"
  | "payments"
  | "mobile";

export type PermissionCode =
  | "admin.users.view"
  | "admin.users.manage"
  | "admin.roles.view"
  | "admin.roles.manage"
  | "admin.settings.view"
  | "admin.settings.manage"
  | "crm.customers.view"
  | "crm.customers.create"
  | "crm.customers.edit"
  | "crm.interactions.view"
  | "crm.interactions.create"
  | "crm.followups.view"
  | "crm.followups.create"
  | "crm.followups.edit"
  | "quotes.view"
  | "quotes.create"
  | "quotes.edit"
  | "quotes.status.change"
  | "catalog.products.view"
  | "catalog.products.create"
  | "catalog.products.edit"
  | "catalog.categories.view"
  | "catalog.categories.create"
  | "catalog.categories.edit"
  | "sales.orders.view"
  | "sales.orders.create"
  | "sales.orders.edit"
  | "sales.orders.status.change"
  | "sales.quotes.view"
  | "sales.quotes.create"
  | "billing.fiscal.view"
  | "billing.fiscal.manage"
  | "billing.invoices.view"
  | "billing.invoices.create"
  | "inventory.products.view"
  | "inventory.stock.view"
  | "inventory.stock.adjust"
  | "inventory.movements.view"
  | "inventory.warehouses.view"
  | "inventory.warehouses.manage"
  | "dispatch.orders.view"
  | "dispatch.orders.create"
  | "dispatch.orders.edit"
  | "dispatch.orders.status.change"
  | "inbox.conversations.view"
  | "inbox.conversations.create"
  | "inbox.conversations.reply"
  | "inbox.conversations.assign"
  | "inbox.conversations.status.change"
  | "inbox.channels.view"
  | "inbox.channels.manage"
  | "driver.tracking.use"
  | "driver.tracking.view"
  | "driver.tracking.manage"
  | "hr.timesheets.view"
  | "hr.timesheets.manage"
  | "hr.timesheets.register"
  | "hr.timesheets.dashboard"
  | "hr.timesheets.states.manage"
  | "hr.timesheets.create"
  | "reports.dashboard.view"
  | "ai.reports.use"
  | "autoblog.view"
  | "autoblog.create"
  | "autoblog.edit"
  | "autoblog.publish"
  | "autoblog.manage"
  | "purchases.suppliers.view"
  | "purchases.suppliers.manage"
  | "purchases.orders.view"
  | "purchases.orders.manage"
  | "payments.accounts.view"
  | "payments.accounts.manage"
  | "mobile.access";

export type PlanCode = "starter" | "pro" | "enterprise";

export type JsonRecord = Record<string, unknown>;

export type Empresa = {
  id: string;
  nombre: string;
  nombreComercial: string | null;
  identificacionFiscal: string | null;
  correo: string | null;
  telefono: string | null;
  estado: EmpresaEstado;
  createdAt: string;
  updatedAt: string;
};

export type Sucursal = {
  id: string;
  empresaId: string;
  nombre: string;
  codigo: string | null;
  direccion: string | null;
  telefono: string | null;
  estado: SucursalEstado;
  createdAt: string;
  updatedAt: string;
};

export type Profile = {
  id: string;
  empresaId: string;
  sucursalId: string | null;
  rolId: string | null;
  nombre: string;
  correo: string;
  telefono: string | null;
  estado: ProfileEstado;
  ultimoAcceso: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AuthenticatedProfile = Profile & {
  estado: "activo";
};

export type Rol = {
  id: string;
  empresaId: string;
  nombre: string;
  descripcion: string | null;
  esSistema: boolean;
  estado: RolEstado;
  createdAt: string;
  updatedAt: string;
};

export type Permiso = {
  id: string;
  codigo: PermissionCode;
  nombre: string;
  descripcion: string | null;
  moduloCodigo: ModuleCode | null;
  estado: CatalogEstado;
  createdAt: string;
};

export type RolPermiso = {
  id: string;
  empresaId: string;
  rolId: string;
  permisoId: string;
  createdAt: string;
};

export type Modulo = {
  id: string;
  codigo: ModuleCode;
  nombre: string;
  descripcion: string | null;
  estado: CatalogEstado;
  orden: number;
  createdAt: string;
};

export type EmpresaModulo = {
  id: string;
  empresaId: string;
  moduloId: string;
  estado: CatalogEstado;
  fechaActivacion: string;
  fechaDesactivacion: string | null;
  configuracion: JsonRecord;
};

export type Plan = {
  id: string;
  codigo: PlanCode;
  nombre: string;
  descripcion: string | null;
  precioBase: number;
  estado: CatalogEstado;
  limites: JsonRecord;
  createdAt: string;
};

export type EmpresaPlan = {
  id: string;
  empresaId: string;
  planId: string;
  planCode?: PlanCode;
  estado: EmpresaPlanEstado;
  fechaInicio: string;
  fechaFin: string | null;
  renovacionAutomatica: boolean;
  limitesOverride: JsonRecord;
  createdAt: string;
};

export type ConfiguracionEmpresa = {
  id: string;
  empresaId: string;
  clave: string;
  valor: JsonRecord;
  createdAt: string;
  updatedAt: string;
};

export type AuditoriaEvento = {
  id: string;
  empresaId: string;
  usuarioId: string | null;
  sucursalId: string | null;
  entidad: string;
  entidadId: string | null;
  accion: string;
  datosAntes: JsonRecord | null;
  datosDespues: JsonRecord | null;
  metadata: JsonRecord;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
};

export type TenantContext = {
  empresaId: string;
  profileId: string;
  profileEmail?: string;
  profileName?: string;
  sucursalId?: string;
  rolId?: string;
  permissions: PermissionCode[];
  activeModules: ModuleCode[];
  planCode?: PlanCode;
};
