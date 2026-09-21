import "server-only";

import { z } from "zod";

import { getAgentCapabilityBlueprints } from "@/modules/brain/runtime/agent-capability-expansion";
import type {
  BrainAgentId,
  BrainEvidence,
  BrainResultLink,
  BusinessSkillDefinition,
  BusinessSkillKind,
} from "@/modules/brain/runtime/contracts";
import { defineBusinessSkill } from "@/modules/brain/runtime/contracts";
import {
  getInventoryMovements,
  getInventoryStock,
  getInventorySummary,
  getWarehouses,
} from "@/modules/inventory/queries";
import type {
  InventoryMovement,
  InventoryStock,
  InventorySummary,
  InventoryWarehouse,
} from "@/modules/inventory/types";
import {
  getPurchaseOrderItems,
  getPurchaseOrders,
  getPurchaseSuppliers,
  getPurchasesSummary,
} from "@/modules/purchases/queries";
import type {
  PurchaseOrder,
  PurchaseOrderItem,
  PurchaseSupplier,
  PurchasesSummary,
} from "@/modules/purchases/types";
import type {
  CoreResult,
  JsonRecord,
  PermissionCode,
  TenantContext,
} from "@/types/core";
import { ok } from "@/types/core";

type AgentAction = "analyze" | "monitor" | "prepare" | "query" | "recommend";

type OperationalAgentBlueprint = {
  actionDescription: string;
  actionId: AgentAction;
  actionName: string;
  areaDescription: string;
  areaId: string;
  areaName: string;
  capabilityId: string;
  kind: BusinessSkillKind;
};

type InventoryPurchasesDataset = {
  inventorySummary: InventorySummary | null;
  movements: InventoryMovement[];
  orderItems: PurchaseOrderItem[];
  orders: PurchaseOrder[];
  purchasesSummary: PurchasesSummary | null;
  stock: InventoryStock[];
  suppliers: PurchaseSupplier[];
  warehouses: InventoryWarehouse[];
};

const operationalInputSchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(10),
  query: z.string().trim().optional(),
});

const operationalOutputSchema = z.object({
  action: z.string(),
  agent: z.string(),
  area: z.string(),
  highlights: z.array(z.string()),
  items: z.array(z.record(z.string(), z.unknown())),
  recommendations: z.array(z.string()),
  summary: z.record(z.string(), z.unknown()),
});

function normalize(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function dataOrEmpty<T>(result: CoreResult<T[]>): T[] {
  return result.ok ? result.data : [];
}

function dataOrNull<T>(result: CoreResult<T>): T | null {
  return result.ok ? result.data : null;
}

function sourceEvidence(source: string, count: number): BrainEvidence[] {
  return [{ count, freshnessAt: new Date().toISOString(), source }];
}

function matchesQuery(record: JsonRecord, query?: string) {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return true;

  return Object.values(record).some((value) =>
    normalize(value).includes(normalizedQuery),
  );
}

function topBy<T>(items: T[], score: (item: T) => number, limit: number) {
  return [...items].sort((left, right) => score(right) - score(left)).slice(0, limit);
}

function lowStockScore(stock: InventoryStock) {
  if (stock.stockMinimo <= 0) return 0;
  return Math.max(stock.stockMinimo - stock.cantidad, 0) + stock.stockMinimo;
}

function pendingOrderValue(item: PurchaseOrderItem) {
  return item.cantidadPendiente * item.costoUnitario;
}

async function loadDataset(tenant: TenantContext): Promise<InventoryPurchasesDataset> {
  const [
    inventorySummary,
    stock,
    warehouses,
    movements,
    suppliers,
    orders,
    orderItems,
    purchasesSummary,
  ] = await Promise.all([
    getInventorySummary(tenant),
    getInventoryStock(tenant),
    getWarehouses(tenant),
    getInventoryMovements(tenant, "todos"),
    getPurchaseSuppliers(tenant),
    getPurchaseOrders(tenant),
    getPurchaseOrderItems(tenant),
    getPurchasesSummary(tenant),
  ]);

  return {
    inventorySummary: dataOrNull(inventorySummary),
    movements: dataOrEmpty(movements),
    orderItems: dataOrEmpty(orderItems),
    orders: dataOrEmpty(orders),
    purchasesSummary: dataOrNull(purchasesSummary),
    stock: dataOrEmpty(stock),
    suppliers: dataOrEmpty(suppliers),
    warehouses: dataOrEmpty(warehouses),
  };
}

function buildSummary(dataset: InventoryPurchasesDataset): JsonRecord {
  const lowStock = dataset.stock.filter(
    (item) => item.stockMinimo > 0 && item.cantidad <= item.stockMinimo,
  );
  const openOrders = dataset.orders.filter((order) =>
    ["borrador", "emitida", "parcial"].includes(order.estado),
  );
  const pendingItems = dataset.orderItems.filter((item) => item.cantidadPendiente > 0);

  return {
    activeSuppliers: dataset.suppliers.filter((supplier) => supplier.estado === "activo").length,
    activeWarehouses: dataset.warehouses.filter((warehouse) => warehouse.estado === "activa").length,
    inventorySummary: dataset.inventorySummary,
    lowStock: lowStock.length,
    movements: dataset.movements.length,
    openOrders: openOrders.length,
    pendingOrderValue: pendingItems.reduce((total, item) => total + pendingOrderValue(item), 0),
    productsWithStock: new Set(dataset.stock.filter((item) => item.cantidad > 0).map((item) => item.productoId)).size,
    purchasesSummary: dataset.purchasesSummary,
    stockRows: dataset.stock.length,
  };
}

function inventoryItems(
  blueprint: OperationalAgentBlueprint,
  dataset: InventoryPurchasesDataset,
  limit: number,
  query?: string,
): JsonRecord[] {
  const stock = dataset.stock.filter((item) =>
    matchesQuery(item as unknown as JsonRecord, query),
  );
  const movements = dataset.movements.filter((item) =>
    matchesQuery(item as unknown as JsonRecord, query),
  );

  switch (blueprint.areaId) {
    case "stock":
      return topBy(stock, (item) => item.cantidad, limit) as unknown as JsonRecord[];
    case "low-stock":
    case "stockouts":
    case "replenishment":
      return topBy(
        stock.filter((item) => item.stockMinimo > 0 && item.cantidad <= item.stockMinimo),
        lowStockScore,
        limit,
      ) as unknown as JsonRecord[];
    case "warehouses":
      return dataset.warehouses.slice(0, limit) as unknown as JsonRecord[];
    case "movements":
    case "counts":
      return movements.slice(0, limit) as unknown as JsonRecord[];
    case "transfers":
      return movements
        .filter((movement) => normalize(movement.motivo).includes("traslado"))
        .slice(0, limit) as unknown as JsonRecord[];
    case "dead-stock":
      return stock
        .filter((item) => item.cantidad > 0)
        .filter((item) => {
          const lastMovement = movements.find(
            (movement) => movement.productoNombre === item.productoNombre,
          );
          return !lastMovement;
        })
        .slice(0, limit) as unknown as JsonRecord[];
    case "thresholds":
      return stock
        .filter((item) => item.stockMinimo > 0 || item.stockMaximo != null)
        .slice(0, limit) as unknown as JsonRecord[];
    case "valuation":
      return topBy(stock, (item) => item.cantidad, limit) as unknown as JsonRecord[];
    default:
      return stock.slice(0, limit) as unknown as JsonRecord[];
  }
}

function purchasesItems(
  blueprint: OperationalAgentBlueprint,
  dataset: InventoryPurchasesDataset,
  limit: number,
  query?: string,
): JsonRecord[] {
  const orders = dataset.orders.filter((item) =>
    matchesQuery(item as unknown as JsonRecord, query),
  );
  const suppliers = dataset.suppliers.filter((item) =>
    matchesQuery(item as unknown as JsonRecord, query),
  );
  const orderItems = dataset.orderItems.filter((item) =>
    matchesQuery(item as unknown as JsonRecord, query),
  );

  switch (blueprint.areaId) {
    case "suppliers":
    case "negotiation":
    case "quality":
      return suppliers.slice(0, limit) as unknown as JsonRecord[];
    case "orders":
    case "overdue":
    case "lead-times":
      return topBy(
        orders.filter((order) => ["borrador", "emitida", "parcial"].includes(order.estado)),
        (order) => order.total,
        limit,
      ) as unknown as JsonRecord[];
    case "receipts":
      return orderItems
        .filter((item) => item.cantidadPendiente > 0)
        .slice(0, limit) as unknown as JsonRecord[];
    case "costs":
      return topBy(orderItems, (item) => item.costoUnitario, limit) as unknown as JsonRecord[];
    case "replenishment":
    case "sourcing":
      return topBy(
        dataset.stock.filter((item) => item.stockMinimo > 0 && item.cantidad <= item.stockMinimo),
        lowStockScore,
        limit,
      ) as unknown as JsonRecord[];
    default:
      return orders.slice(0, limit) as unknown as JsonRecord[];
  }
}

function itemsFor(
  agentId: BrainAgentId,
  blueprint: OperationalAgentBlueprint,
  dataset: InventoryPurchasesDataset,
  limit: number,
  query?: string,
) {
  return agentId === "inventario"
    ? inventoryItems(blueprint, dataset, limit, query)
    : purchasesItems(blueprint, dataset, limit, query);
}

function recommendationsFor(
  agentId: BrainAgentId,
  blueprint: OperationalAgentBlueprint,
  dataset: InventoryPurchasesDataset,
  items: JsonRecord[],
) {
  const summary = buildSummary(dataset);
  const recommendations: string[] = [];

  if (Number(summary.lowStock) > 0) {
    recommendations.push(`Revisar ${summary.lowStock} producto(s) con stock bajo o en riesgo.`);
  }

  if (Number(summary.openOrders) > 0) {
    recommendations.push(`Dar seguimiento a ${summary.openOrders} orden(es) de compra abierta(s).`);
  }

  if (agentId === "inventario" && blueprint.areaId === "thresholds") {
    recommendations.push("Actualizar minimos y maximos de productos con rotacion o quiebres frecuentes.");
  }

  if (agentId === "compras" && blueprint.areaId === "replenishment") {
    recommendations.push("Convertir productos bajo minimo en sugerencias de compra antes de quedarse sin stock.");
  }

  if (blueprint.areaId === "costs") {
    recommendations.push("Comparar costos unitarios altos contra historial antes de emitir nuevas ordenes.");
  }

  if (items.length === 0) {
    recommendations.push(`No encontre elementos criticos especificos para ${blueprint.areaName}.`);
  }

  return recommendations.length > 0
    ? recommendations.slice(0, 5)
    : ["No hay alertas criticas con los datos disponibles."];
}

function highlightsFor(
  agentId: BrainAgentId,
  blueprint: OperationalAgentBlueprint,
  dataset: InventoryPurchasesDataset,
  items: JsonRecord[],
) {
  const summary = buildSummary(dataset);
  const base =
    agentId === "inventario"
      ? [
          `Filas de stock visibles: ${summary.stockRows}.`,
          `Productos bajo minimo: ${summary.lowStock}.`,
          `Bodegas activas: ${summary.activeWarehouses}.`,
          `Movimientos recientes visibles: ${summary.movements}.`,
        ]
      : [
          `Proveedores activos: ${summary.activeSuppliers}.`,
          `Ordenes abiertas: ${summary.openOrders}.`,
          `Valor pendiente de recepcion: ${summary.pendingOrderValue}.`,
          `Productos bajo minimo conectables a compras: ${summary.lowStock}.`,
        ];

  base.push(`Elementos priorizados para ${blueprint.areaName}: ${items.length}.`);
  return base;
}

function messageFor(
  agentId: BrainAgentId,
  blueprint: OperationalAgentBlueprint,
  items: JsonRecord[],
  recommendations: string[],
) {
  const agentName = agentId === "inventario" ? "Inventario" : "Compras";

  if (blueprint.actionId === "recommend") {
    return `${agentName}: recomendacion para ${blueprint.areaName}: ${recommendations[0]}`;
  }

  if (blueprint.actionId === "prepare") {
    return `${agentName}: prepare un borrador de plan para ${blueprint.areaName} con ${items.length} elemento(s).`;
  }

  if (blueprint.actionId === "monitor") {
    return `${agentName}: monitoreo de ${blueprint.areaName} encontro ${items.length} elemento(s).`;
  }

  if (blueprint.actionId === "analyze") {
    return `${agentName}: analisis de ${blueprint.areaName} con ${recommendations.length} punto(s) accionable(s).`;
  }

  return `${agentName}: consulta de ${blueprint.areaName} encontro ${items.length} elemento(s).`;
}

function linksFor(agentId: BrainAgentId, blueprint: OperationalAgentBlueprint): BrainResultLink[] {
  if (agentId === "inventario") {
    if (blueprint.areaId === "warehouses") return [{ href: "/inventario/bodegas", label: "Abrir bodegas" }];
    if (blueprint.areaId === "movements" || blueprint.areaId === "transfers") {
      return [{ href: "/inventario/movimientos", label: "Abrir movimientos" }];
    }
    return [{ href: "/inventario", label: "Abrir inventario" }];
  }

  return [{ href: "/compras", label: "Abrir compras" }];
}

function createOperationalAgentSkill(
  agentId: "compras" | "inventario",
  blueprint: OperationalAgentBlueprint,
): BusinessSkillDefinition {
  const moduleCode = agentId === "inventario" ? "inventory" : "purchases";
  const requiredPermissions: PermissionCode[] =
    agentId === "inventario"
      ? ["inventory.stock.view"]
      : ["purchases.orders.view", "inventory.stock.view"];

  return defineBusinessSkill({
    description: `${blueprint.actionName} ${blueprint.areaDescription} usando datos reales de inventario, compras, bodegas y movimientos.`,
    enabled: true,
    id: `${blueprint.capabilityId}.skill.v1`,
    idempotency: "none",
    inputSchema: operationalInputSchema,
    kind: blueprint.kind,
    module: moduleCode,
    name: `${blueprint.actionName} ${blueprint.areaName}`,
    outputSchema: operationalOutputSchema,
    requiredPermissions,
    requiresConfirmation: false,
    risk: "low",
    version: "1.0.0",
    async execute(input, context) {
      const dataset = await loadDataset(context.tenant);
      const items = itemsFor(agentId, blueprint, dataset, input.limit, input.query);
      const recommendations = recommendationsFor(agentId, blueprint, dataset, items);
      const highlights = highlightsFor(agentId, blueprint, dataset, items);

      return ok({
        data: {
          action: blueprint.actionId,
          agent: agentId,
          area: blueprint.areaId,
          highlights,
          items,
          recommendations,
          summary: buildSummary(dataset),
        },
        evidence: [
          ...sourceEvidence("inventario_stock", dataset.stock.length),
          ...sourceEvidence("inventario_bodegas", dataset.warehouses.length),
          ...sourceEvidence("inventario_movimientos", dataset.movements.length),
          ...sourceEvidence("purchases_orders", dataset.orders.length),
          ...sourceEvidence("purchases_order_items", dataset.orderItems.length),
          ...sourceEvidence("purchases_suppliers", dataset.suppliers.length),
        ],
        links: linksFor(agentId, blueprint),
        message: messageFor(agentId, blueprint, items, recommendations),
      });
    },
  });
}

export function createInventoryPurchasesAgentBusinessSkills(): BusinessSkillDefinition[] {
  return [
    ...getAgentCapabilityBlueprints("inventario").map((blueprint) =>
      createOperationalAgentSkill("inventario", blueprint),
    ),
    ...getAgentCapabilityBlueprints("compras").map((blueprint) =>
      createOperationalAgentSkill("compras", blueprint),
    ),
  ];
}
