export type BrainSemanticCorpusCase = {
  expectedCapabilityId: string;
  expectedModule: string;
  id: string;
  message: string;
};

const seeds = [
  ["crm.customer.search", "crm", "busca al cliente Ana Solis"],
  ["crm.customer.create", "crm", "crea un cliente llamado Taller El Roble"],
  ["crm.customer.history", "crm", "muéstrame el historial del cliente Acme"],
  ["crm.followup.create", "crm", "crea un seguimiento para llamar a Ana mañana"],
  ["catalog.product.search", "catalog", "busca el producto café premium"],
  ["catalog.product.create", "catalog", "registra un producto nuevo llamado Café 500g"],
  ["catalog.product.update", "catalog", "actualiza el precio del producto Café 500g"],
  ["catalog.product.validate", "catalog", "valida si el producto Café 500g está listo para vender"],
  ["inventory.stock.query", "inventory", "cuánto stock queda de Café 500g"],
  ["inventory.stock.adjust", "inventory", "ajusta el inventario de Café 500g a 20 unidades"],
  ["inventory.stock.transfer", "inventory", "transfiere 5 Café 500g de la bodega central a la norte"],
  ["inventory.reorder.suggest", "inventory", "sugiéreme qué inventario debo reordenar"],
  ["sales.summary.query", "sales", "dame el resumen de ventas de esta semana"],
  ["ventas.quotes.query.skill.v1", "sales", "cuántas cotizaciones abiertas tenemos y cuánto suman"],
  ["quotes.draft.create", "quotes", "prepara una cotización para Ana con dos Café 500g"],
  ["quotes.expired.query", "quotes", "qué cotizaciones están vencidas"],
  ["quotes.sale.confirm", "quotes", "confirma la venta de la cotización COT-104"],
  ["payments.overdue.query", "payments", "qué cuentas por cobrar están vencidas"],
  ["payments.payable.query", "payments", "qué pagos a proveedores tengo pendientes"],
  ["payments.collection-reminder.create", "payments", "prepara un recordatorio de cobro para Acme"],
  ["purchases.order.query", "purchases", "muéstrame las órdenes de compra pendientes"],
  ["purchases.reorder.suggest", "purchases", "sugiere una compra para reponer faltantes"],
  ["dispatch.pending.query", "dispatch", "qué entregas siguen pendientes"],
  ["inbox.reply.draft", "whapp", "redacta una respuesta para el último chat del cliente"],
  ["autoblog.article.generate", "autoblog", "escribe un artículo para el blog sobre café artesanal"],
] as const;

const variants = [
  (message: string) => message,
  (message: string) => `Por favor ${message}`,
  (message: string) => `Necesito que ${message}`,
  (message: string) => `Brain, ${message}`,
  (message: string) => `¿Me ayudas a que el sistema ${message}?`,
  (message: string) => `Desde aquí quiero que ${message}`,
  (message: string) => `Haz esto por mí: ${message}`,
  (message: string) => `Cuando puedas, ${message}`,
  (message: string) => `Ocúpate de lo siguiente: ${message}`,
  (message: string) => `En lenguaje sencillo: ${message}`,
] as const;

export const brainSemanticCorpus: BrainSemanticCorpusCase[] = seeds.flatMap(
  ([expectedCapabilityId, expectedModule, message], seedIndex) =>
    variants.map((render, variantIndex) => ({
      expectedCapabilityId,
      expectedModule,
      id: `brain-semantic-${String(seedIndex + 1).padStart(2, "0")}-${variantIndex + 1}`,
      message: render(message),
    })),
);
