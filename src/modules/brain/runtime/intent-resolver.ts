import "server-only";

import type {
  BusinessIntentRegistry,
  BusinessIntentResolution,
} from "@/modules/brain/runtime/contracts";
import { parseProductCreationEntities } from "@/modules/brain/runtime/product-creation-parser";
import type { CoreResult, JsonRecord } from "@/types/core";
import { fail, ok } from "@/types/core";

type IntentResolverInput = {
  context?: Record<string, unknown>;
  message: string;
};

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\w\s@.+-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function firstMatch(value: string, pattern: RegExp) {
  return value.match(pattern)?.[1]?.trim();
}

function cleanQuery(value: string) {
  return normalize(value)
    .replace(/^["']+|["']+$/g, "")
    .replace(/\b(del|de|el|la|los|las)\s+producto\s+/g, "")
    .replace(/\bproducto\s+/g, "")
    .trim();
}

function stripCustomerPrefix(original: string) {
  return original
    .replace(/^quiero que\s+/i, "")
    .replace(/^por favor\s+/i, "")
    .replace(/^me puedes\s+/i, "")
    .replace(/^puedes\s+/i, "")
    .replace(/^registre a\s+/i, "")
    .replace(/^registrar a\s+/i, "")
    .replace(/^agregue a\s+/i, "")
    .replace(/^agrega a\s+/i, "")
    .replace(/^agregar a\s+/i, "")
    .replace(/^(?:crea|crear|crees) un cliente(?: que se llame| llamado)?\s*/i, "")
    .replace(/^(?:crea|crear|crees) cliente(?: que se llame| llamado)?\s*/i, "")
    .replace(/^registre(?: un)? cliente(?: que se llame)?\s*/i, "")
    .replace(/^registrar(?: un)? cliente(?: que se llame)?\s*/i, "")
    .replace(/^agregue(?: un)? cliente(?: que se llame)?\s*/i, "")
    .replace(/^agrega(?: un)? cliente(?: que se llame)?\s*/i, "")
    .replace(/^agregar(?: un)? cliente(?: que se llame)?\s*/i, "")
    .replace(/^nuevo cliente\s*/i, "")
    .replace(/^cliente nuevo\s*/i, "")
    .trim();
}

function extractBeforeLabels(value: string) {
  return value
    .split(
      /\b(?:con\s+)?(?:correo|email|mail|cedula|c(?:e|\u00e9)dula|ced|id|identificacion|identificaci(?:o|\u00f3)n|cc|numero|n(?:u|\u00fa)mero|telefono|tel(?:e|\u00e9)fono|tel|celular|cel|whatsapp)\b/i,
    )[0]
    ?.replace(/\bque se llame\b/i, "")
    .replace(/\bse llame\b/i, "")
    .replace(/^llamad[oa]\s+/i, "")
    .replace(/\bcon\b$/i, "")
    .trim();
}

function resolve(
  intentId: string,
  capabilityId: string,
  entities: JsonRecord = {},
  confidence = 0.9,
): BusinessIntentResolution {
  return {
    capabilityId,
    confidence,
    entities,
    intentId,
    source: "deterministic",
  };
}

function isNegativeExecutionRequest(message: string) {
  const normalized = normalize(message);

  return (
    /\bno\s+(?:quiero\s+que\s+)?(?:crees?|crear|agregues?|agregar|registres?|registrar|generes?|generar|prepares?|preparar|env[ií]es?|enviar|respondas?|responder|confirmes?|confirmar|apliques?|aplicar|ejecutes?|ejecutar|hagas?|hacer)\b/.test(
      normalized,
    ) ||
    /\b(?:no\s+lo\s+hagas|no\s+ejecutes|no\s+confirmes|cancelar\s+accion|cancela\s+la\s+accion)\b/.test(
      normalized,
    )
  );
}

function parseCreateCustomer(message: string) {
  const normalized = normalize(message);
  const isCreateCustomer =
    /^(?:quiero que\s+|por favor\s+|me puedes\s+|puedes\s+)?(?:crea|crear|crees|registre|registrar|agregue|agrega|agregar|nuevo|alta|dar de alta)\b/.test(
      normalized,
    ) && /\bcliente\b/.test(normalized);

  if (!isCreateCustomer) return null;

  const email = firstMatch(message, /\b([\w.+-]+@[\w.-]+\.\w+)\b/i);
  const identificacion = firstMatch(
    message,
    /\b(?:cedula|c(?:e|\u00e9)dula|ced|id|identificacion|identificaci(?:o|\u00f3)n|cc)\s*[:#-]?\s*([0-9-]{6,20})\b/i,
  )?.replace(/\D/g, "");
  const whatsapp = firstMatch(
    message,
    /\b(?:whatsapp|WhatsApp)\s*[:#-]?\s*([0-9\s-]{7,20})\b/,
  )?.replace(/\D/g, "");
  const telefono = (
    whatsapp ||
    firstMatch(
      message,
      /\b(?:numero|n(?:u|\u00fa)mero|telefono|tel(?:e|\u00e9)fono|tel|celular|cel)\s*[:#-]?\s*([0-9\s-]{7,20})\b/i,
    )
  )?.replace(/\D/g, "");
  const explicitName = firstMatch(
    message,
    /\b(?:nombre|llamado|llamada|se llama)\s*[:#-]?\s*([\p{L}\s.'-]{2,80}?)(?=\s*,?\s*(?:con\s+)?(?:cedula|c(?:e|\u00e9)dula|ced|id|identificacion|identificaci(?:o|\u00f3)n|cc|numero|n(?:u|\u00fa)mero|telefono|tel(?:e|\u00e9)fono|tel|celular|cel|whatsapp|correo|email|mail)\b|$)/iu,
  );
  const nameCandidate = explicitName ?? extractBeforeLabels(stripCustomerPrefix(message));
  const nombre =
    nameCandidate && normalize(nameCandidate) !== "cliente" ? nameCandidate : undefined;

  return resolve(
    "crm.customer.create",
    "crm.customer.create",
    {
      correo: email,
      genero: "o",
      identificacion,
      nombre,
      telefono,
      tipo: "prospecto",
      whatsapp,
    },
    nombre ? 0.96 : 0.72,
  );
}

function parseCreateProduct(message: string) {
  const normalized = normalize(message);
  if (!/\b(crear|crea|agregar|agregue|nuevo)\s+(?:(?:un|el)\s+)?(producto|servicio)\b/.test(normalized)) {
    return null;
  }

  const product = parseProductCreationEntities(message);

  return resolve(
    "catalog.product.create",
    "catalog.product.create",
    {
      bodegaNombre: product.bodegaNombre,
      cantidadInicial: product.cantidadInicial,
      moneda: "CRC",
      nombre: product.nombre,
      precioBase: product.precioBase,
      tipo: normalized.includes("servicio") ? "servicio" : "producto",
      unidadMedida: "unidad",
    },
    product.nombre ? 0.9 : 0.68,
  );
}

const numberWords: Record<string, number> = {
  diez: 10,
  dos: 2,
  nueve: 9,
  ocho: 8,
  seis: 6,
  siete: 7,
  tres: 3,
  un: 1,
  una: 1,
  uno: 1,
  cinco: 5,
  cuatro: 4,
};

function parseQuantity(value: string | undefined) {
  if (!value) return undefined;
  const normalized = normalize(value);
  const numeric = Number(normalized);
  if (Number.isFinite(numeric) && numeric > 0) return numeric;
  return numberWords[normalized];
}

function parseMoney(value: string | undefined) {
  if (!value) return undefined;
  const numeric = Number(value.replace(/[^\d.]/g, ""));
  return Number.isFinite(numeric) && numeric > 0 ? numeric : undefined;
}

function parseQuoteDraftEntities(message: string) {
  const normalized = normalize(message);
  const customerQuery = firstMatch(
    normalized,
    /\b(?:para|cliente)\s+([\w\s.'-]+?)(?=\s+(?:con|incluyendo|que|por)\b|$)/i,
  );
  const itemText = firstMatch(
    message,
    /\b(?:con|incluyendo|incluye)\s+(.+)$/i,
  );
  const quantity = parseQuantity(
    itemText?.match(/^\s*(\d+(?:[.,]\d+)?|un|una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\b/i)?.[1],
  );
  const price = parseMoney(
    itemText?.match(/\b(?:precio|a|por|de)\s*(?:crc|₡|\$)?\s*([0-9][0-9.,]*)\b/i)?.[1],
  );
  const description = itemText
    ?.replace(/^\s*(\d+(?:[.,]\d+)?|un|una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\s+/i, "")
    .replace(/\b(?:precio|a|por|de)\s*(?:crc|₡|\$)?\s*[0-9][0-9.,]*\b.*$/i, "")
    .trim();
  const productDescription = description ? normalize(description) : "";
  const isGenericProduct =
    /^(guante|guantes|lente|lentes|casco|cascos|producto|productos|servicio|servicios)$/.test(
      productDescription,
    );
  const hasCompleteItem = Boolean(description && quantity && price && !isGenericProduct);

  return {
    content: message,
    customerQuery,
    items: hasCompleteItem
      ? [
          {
            cantidad: quantity,
            descripcion: description,
            descuento: 0,
            impuestoPorcentaje: 0,
            precioUnitario: price,
          },
        ]
      : undefined,
  };
}

function parseModuleCommand(message: string) {
  const normalized = normalize(message);

  if (
    /\b(?:crear|crea|agendar|agenda|programar|programa)\b/.test(normalized) &&
    /\b(?:seguimiento|llamar)\b/.test(normalized) &&
    /\b(?:cliente|venta|cotizacion|proforma|para)\b/.test(normalized)
  ) {
    const customerMatch = message.match(/\bpara\s+(.+?)(?:\s+(?:manana|mañana|hoy|el|a las|por|de la venta|de cotizacion|de proforma)\b|$)/i);
    const saleMatch = message.match(/\bventa\s+([A-Za-z0-9-]+)/i);
    const quoteMatch = message.match(/\b(?:cotizacion|cotización|proforma)\s+([A-Za-z0-9-]+)/i);

    return resolve("crm.followup.create", "crm.followup.create", {
      customerQuery: customerMatch?.[1]?.trim(),
      quoteReference: quoteMatch?.[1]?.trim(),
      saleReference: saleMatch?.[1]?.trim(),
      title: message
        .replace(/^(?:crear|crea|agendar|agenda|programar|programa)\s+(?:una\s+)?(?:tarea|seguimiento|recordatorio)?\s*/i, "")
        .trim() || "Seguimiento creado por Brain",
    }, 0.86);
  }

  if (
    /\b(?:crear|crea|agendar|agenda|programar|programa)\b/.test(normalized) &&
    /\b(?:tarea|seguimiento|recordatorio|llamar)\b/.test(normalized)
  ) {
    return resolve("agenda.task.create", "agenda.task.create", {
      description: message,
      title: message
        .replace(/^(?:crear|crea|agendar|agenda|programar|programa)\s+(?:una\s+)?(?:tarea|seguimiento|recordatorio)?\s*/i, "")
        .trim() || "Tarea creada por Brain",
    }, 0.84);
  }

  if (
    /\b(?:prepara|preparar|crear|crea|hacer)\b/.test(normalized) &&
    /\b(?:factura|borrador\s+fiscal|documento\s+fiscal)\b/.test(normalized)
  ) {
    return resolve("billing.draft.prepare", "billing.draft.prepare", {
      query: message,
    }, 0.82);
  }

  const blogTopic = normalized.match(
    /\b(?:crear|crea|generar|genera|escribir|escribe)\s+(?:un\s+)?(?:blog|articulo|post)(?:\s+(?:sobre|de)?\s*(.*))?$/,
  );
  if (blogTopic) {
    return resolve("autoblog.article.generate", "autoblog.article.generate", {
      topic: blogTopic[1]?.trim(),
    }, blogTopic[1] ? 0.86 : 0.7);
  }

  return null;
}

function parseSearchAndRead(message: string) {
  const normalized = normalize(message);

  const customerMatch = normalized.match(/\b(?:busca|buscar|encuentra|encontrar)\s+(?:al\s+)?(?:cliente|clientes)\s+(.+)$/);
  if (customerMatch?.[1]) {
    return resolve("crm.customer.search", "crm.customer.search", {
      limit: 8,
      query: customerMatch[1].trim(),
    });
  }

  const productMatch = normalized.match(/\b(?:busca|buscar|encuentra|encontrar)\s+(?:el\s+)?(?:producto|productos|servicio|servicios)\s+(.+)$/);
  if (productMatch?.[1]) {
    return resolve("catalog.product.search", "catalog.product.search", {
      limit: 8,
      query: productMatch[1].trim(),
    });
  }

  if (/\b(?:stock|inventario)\s+bajo\b/.test(normalized)) {
    return resolve("inventory.reorder.suggest", "inventory.reorder.suggest", {
      limit: 10,
    });
  }

  const stockPatterns = [
    /\b(?:cuanto|cuanta|cuantos|cuantas)\s+(?:stock|inventario|existencias)\s+(?:tenemos|hay)?\s*(?:del|de)?\s*(?:el\s+)?(?:producto\s+)?(.+)$/,
    /\b(?:stock|inventario|existencias)\s+(?:disponible\s+)?(?:del|de)?\s*(?:el\s+)?(?:producto\s+)?(.+)$/,
    /\b(?:hay|tenemos)\s+(?:stock|inventario|existencias)\s+(?:del|de)?\s*(?:el\s+)?(?:producto\s+)?(.+)$/,
    /\b(?:cuantas|cuantos)\s+unidades\s+(?:hay|tenemos)\s+(?:del|de)?\s*(?:el\s+)?(?:producto\s+)?(.+)$/,
  ];
  const stockMatch = stockPatterns.map((pattern) => normalized.match(pattern)).find(Boolean);
  if (stockMatch?.[1]) {
    return resolve("inventory.stock.query", "inventory.stock.query", {
      limit: 8,
      query: cleanQuery(stockMatch[1]),
    }, 0.94);
  }

  if (
    /\b(?:muestra|muestrame|ver|consulta|consultar|buscar)\s+(?:las\s+)?ventas(?:\s+recientes)?\b/.test(
      normalized,
    ) ||
    /\bventas\s+recientes\b/.test(normalized)
  ) {
    return resolve("sales.summary.query", "sales.summary.query", { limit: 10 });
  }

  if (/\b(?:cuentas?\s+por\s+pagar|por\s+pagar|cxp|pagos?\s+a\s+proveedores?).*\b(?:vencidos?|pendientes?)\b/.test(normalized)) {
    return resolve("payments.payable.query", "payments.payable.query", {
      limit: 10,
    });
  }

  if (/\b(?:cobros?|cuentas?\s+por\s+cobrar)\b.*\b(?:vencidos?|pendientes?)\b/.test(normalized)) {
    return resolve("payments.overdue.query", "payments.overdue.query", {
      limit: 10,
    });
  }

  if (/\b(?:ordenes?\s+de\s+compra|compras?)\s+(?:pendientes?|abiertas?)\b/.test(normalized)) {
    return resolve("purchases.order.query", "purchases.order.query", {
      limit: 10,
    });
  }

  if (/\b(?:despachos?|entregas?)\b.*\bpendientes?\b/.test(normalized)) {
    return resolve("dispatch.pending.query", "dispatch.pending.query", {
      limit: 10,
    });
  }

  return null;
}

function parsePlannedCapability(message: string) {
  const normalized = normalize(message);

  if (
    /\bque\s+cliente\s+(debo|tengo)\s+atender\s+primero\b/.test(normalized) ||
    /\bcual\s+cliente\s+(priorizo|atiendo)\b/.test(normalized) ||
    /\bsiguiente\s+cliente\s+(a\s+)?atender\b/.test(normalized)
  ) {
    return resolve("crm.customer.next_best", "crm.customer.next_best", {}, 0.92);
  }

  const customerHistory = normalized.match(
    /\b(?:cuanto\s+me\s+compro|historial\s+(?:del|de)\s+cliente|compras?\s+(?:del|de)\s+cliente)\s+(.+)$/,
  );
  if (customerHistory?.[1]) {
    return resolve("crm.customer.history", "crm.customer.history", {
      customerQuery: customerHistory[1].trim(),
    }, 0.86);
  }

  if (/\b(?:seguimientos?|tareas?)\s+(?:pendientes?|crm|de\s+clientes?)\b/.test(normalized)) {
    return resolve("crm.followup.query", "crm.followup.query", {}, 0.82);
  }

  const updateCustomer = normalized.match(
    /\b(?:actualiza|actualizar|cambia|cambiar|modifica|modificar)\s+(?:el\s+)?(?:cliente|datos?\s+del\s+cliente)\s+(.+)$/,
  );
  if (updateCustomer?.[1]) {
    return resolve("crm.customer.update", "crm.customer.update", {
      content: updateCustomer[1].trim(),
      customerQuery: updateCustomer[1].trim(),
    }, 0.78);
  }

  if (
    /\b(?:actualiza|actualizar|cambia|cambiar|modifica|modificar)\b/.test(normalized) &&
    /\bcliente\b/.test(normalized)
  ) {
    return resolve("crm.customer.update", "crm.customer.update", {
      content: message,
    }, 0.74);
  }

  const updateProduct = normalized.match(
    /\b(?:actualiza|actualizar|cambia|cambiar|modifica|modificar)\s+(?:el\s+)?(?:producto|servicio)\s+(.+)$/,
  );
  if (updateProduct?.[1]) {
    return resolve("catalog.product.update", "catalog.product.update", {
      content: updateProduct[1].trim(),
      productQuery: updateProduct[1].trim(),
    }, 0.78);
  }

  const validateProduct = normalized.match(
    /\b(?:valida|validar|revisa|revisar)\s+(?:el\s+)?(?:producto|servicio)\s+(.+)$/,
  );
  if (validateProduct?.[1]) {
    return resolve("catalog.product.validate", "catalog.product.validate", {
      productQuery: validateProduct[1].trim(),
    }, 0.82);
  }

  const initializeStock = normalized.match(
    /\b(?:inicializa|inicializar)\s+stock\s+(?:del|de)\s+(?:producto\s+)?(.+)$/,
  );
  if (initializeStock?.[1]) {
    return resolve(
      "catalog.product.stock.initialize",
      "catalog.product.stock.initialize",
      { productQuery: initializeStock[1].trim() },
      0.78,
    );
  }

  if (/\b(?:ajusta|ajustar|corrige|corregir)\s+(?:el\s+)?(?:stock|inventario)\b/.test(normalized)) {
    return resolve("inventory.stock.adjust", "inventory.stock.adjust", {}, 0.8);
  }

  if (/\b(?:transfiere|transferir|mueve|mover)\s+(?:stock|inventario|existencias)\b/.test(normalized)) {
    return resolve("inventory.stock.transfer", "inventory.stock.transfer", {}, 0.8);
  }

  if (/\b(?:crea|crear|prepara|preparar|arma|armar)\b.*\b(?:cotizacion|proforma)\b/.test(normalized)) {
    return resolve(
      "quotes.draft.create",
      "quotes.draft.create",
      parseQuoteDraftEntities(message),
      0.82,
    );
  }

  if (
    /\b(?:cotizaciones|proformas)\b/.test(normalized) &&
    /\b(?:vencidas|vencidos|sin\s+respuesta|atrasadas|atrasados)\b/.test(normalized)
  ) {
    return resolve("quotes.expired.query", "quotes.expired.query", {}, 0.84);
  }

  if (/\b(?:agrega|agregar|incluye|incluir)\b.*\b(?:cotizacion|proforma)\b/.test(normalized)) {
    return resolve("quotes.item.add", "quotes.item.add", {}, 0.82);
  }

  if (/\b(?:calcula|calcular|total)\b.*\b(?:cotizacion|proforma)\b/.test(normalized)) {
    return resolve("quotes.total.calculate", "quotes.total.calculate", {}, 0.82);
  }

  if (/\b(?:confirma|confirmar|pasar)\b.*\b(?:cotizacion|proforma)\b.*\bventa\b/.test(normalized)) {
    return resolve("quotes.sale.confirm", "quotes.sale.confirm", {}, 0.84);
  }

  const saleDetail = normalized.match(/\b(?:detalle|ver|abre|abrir)\s+(?:de\s+)?(?:la\s+)?venta\s+(.+)$/);
  if (saleDetail?.[1]) {
    return resolve("sales.order.detail", "sales.order.detail", {
      saleReference: saleDetail[1].trim(),
    }, 0.84);
  }

  if (/\b(?:genera|generar|crear)\s+(?:cuenta\s+por\s+cobrar|cxc)\b/.test(normalized)) {
    return resolve("sales.receivable.generate", "sales.receivable.generate", {}, 0.82);
  }

  if (/\b(?:prepara|preparar|crear)\s+despacho\b.*\bventa\b/.test(normalized)) {
    return resolve("sales.dispatch.prepare", "sales.dispatch.prepare", {}, 0.82);
  }

  if (/\b(?:registra|registrar|aplica|aplicar)\s+(?:cobro|pago|abono)\b/.test(normalized)) {
    return resolve("payments.payment.register", "payments.payment.register", {}, 0.82);
  }

  const statement = normalized.match(
    /\b(?:estado\s+de\s+cuenta|cuanto\s+(?:me\s+)?debe)(?:\s+(?:del|de|el\s+cliente)?\s*(.+))?$/,
  );
  if (statement) {
    const customerQuery = statement[1]?.trim() || undefined;
    return resolve("payments.account.statement", "payments.account.statement", {
      customerQuery,
    }, customerQuery ? 0.84 : 0.7);
  }

  if (/\b(?:nota\s+interna|agrega\s+nota|deja\s+nota)\b/.test(normalized)) {
    return resolve("inbox.note.create", "inbox.note.create", {}, 0.82);
  }

  if (
    /\b(?:sla|atrasad[ao]s?|vencid[ao]s?)\b/.test(normalized) &&
    /\b(?:conversaciones|chats|whatsapp|inbox)\b/.test(normalized)
  ) {
    return resolve("inbox.sla.overdue.query", "inbox.sla.overdue.query", {}, 0.84);
  }

  if (
    /\b(?:responde|responder|contesta|contestar|prepara|preparar)\b/.test(normalized) &&
    /\b(?:whatsapp|inbox|chat|mensaje|conversacion)\b/.test(normalized)
  ) {
    return resolve("inbox.reply.draft", "inbox.reply.draft", {
      conversationReference: firstMatch(
        normalized,
        /\b(este|esta|ese|esa|ultimo|ultima|whatsapp|chat|conversacion|mensaje)\b.*$/i,
      ) ?? normalized,
      content: message,
    }, 0.86);
  }

  if (/\b(?:vincula|vincular|asocia|asociar)\b.*\b(?:chat|conversacion|cliente)\b/.test(normalized)) {
    return resolve("inbox.customer.link", "inbox.customer.link", {}, 0.82);
  }

  if (/\b(?:asigna|asignar|pasar)\b.*\b(?:chat|conversacion|inbox)\b/.test(normalized)) {
    return resolve("inbox.conversation.assign", "inbox.conversation.assign", {}, 0.82);
  }

  if (/\b(?:cierra|cerrar)\b.*\b(?:chat|conversacion|inbox)\b/.test(normalized)) {
    return resolve("inbox.conversation.close", "inbox.conversation.close", {}, 0.82);
  }

  if (/\b(?:valida|validar|revisa|revisar)\b.*\b(?:blog|articulo)\b/.test(normalized)) {
    return resolve("autoblog.article.validate", "autoblog.article.validate", {
      content: message,
    }, 0.8);
  }

  if (/\b(?:normaliza|normalizar|limpia|limpiar)\b.*\b(?:blog|articulo|salida)\b/.test(normalized)) {
    return resolve("autoblog.output.normalize", "autoblog.output.normalize", {
      content: message,
    }, 0.8);
  }

  if (/\b(?:senales|alertas)\b.*\b(?:negocio|brain|operativas|comerciales)?\b/.test(normalized)) {
    return resolve("brain.signals.query", "brain.signals.query", {}, 0.78);
  }

  if (/\b(?:recomiendas|recomendaciones|que\s+hago|que\s+debo\s+hacer)\b/.test(normalized)) {
    return resolve("brain.recommendations.query", "brain.recommendations.query", {}, 0.78);
  }

  if (/\b(?:prepara|preparar|arma|armar)\s+(?:un\s+)?plan\b/.test(normalized)) {
    return resolve("brain.plan.prepare", "brain.plan.prepare", {
      content: message,
    }, 0.78);
  }

  return null;
}

function parseBrainQuestion(message: string) {
  const normalized = normalize(message);

  if (
    /\b(analiza|analizar)\s+(mi\s+)?negocio\b/.test(normalized) ||
    /\b(ejecuta|actualiza|corre)\s+(el\s+)?brain\b/.test(normalized)
  ) {
    return resolve("brain.analysis.run", "brain.analysis.run", { question: message });
  }

  if (
    /\bcomo\s+va\s+(mi\s+)?negocio\b/.test(normalized) ||
    /\bcomo\s+esta\s+(el\s+)?negocio\b/.test(normalized) ||
    /\bque\s+esta\s+pasando\s+esta\s+semana\b/.test(normalized) ||
    /\bque\s+(debo|tengo)\s+atender\s+hoy\b/.test(normalized) ||
    /\bque\s+hay\s+para\s+hoy\b/.test(normalized) ||
    /\bprioridades?\b/.test(normalized)
  ) {
    return resolve("brain.question.answer", "brain.question.answer", {
      question: message,
    }, 0.78);
  }

  return null;
}

function parseContextualSearch(
  message: string,
  context?: Record<string, unknown>,
) {
  const query = message.trim();
  const normalized = normalize(query);
  if (
    normalized.length < 3 ||
    /^(si|no|ok|confirmar|cancelar|abrir|ir a)\b/.test(normalized)
  ) {
    return null;
  }

  const currentModule =
    typeof context?.currentModule === "string" ? context.currentModule : "";
  const currentPath =
    typeof context?.currentPath === "string" ? context.currentPath : "";
  const moduleContext = normalize(`${currentModule} ${currentPath}`);

  if (moduleContext.includes("catalog") || moduleContext.includes("catalogo")) {
    return resolve("catalog.product.search", "catalog.product.search", {
      limit: 8,
      query,
    }, 0.82);
  }

  if (moduleContext.includes("crm") || moduleContext.includes("cliente")) {
    return resolve("crm.customer.search", "crm.customer.search", {
      limit: 8,
      query,
    }, 0.82);
  }

  if (moduleContext.includes("inventario") || moduleContext.includes("inventory")) {
    return resolve("inventory.stock.query", "inventory.stock.query", {
      limit: 8,
      query,
    }, 0.82);
  }

  return null;
}

export function createBusinessIntentResolver(registry: BusinessIntentRegistry) {
  return {
    resolve(input: IntentResolverInput): CoreResult<BusinessIntentResolution> {
      if (isNegativeExecutionRequest(input.message)) {
        return fail(
          "VALIDATION_ERROR",
          "Entendido. No voy a ejecutar ninguna accion con esa instruccion.",
          { terminal: true, type: "negative_execution_request" },
        );
      }

      const parsed =
        parseCreateCustomer(input.message) ||
        parseCreateProduct(input.message) ||
        parseModuleCommand(input.message) ||
        parsePlannedCapability(input.message) ||
        parseSearchAndRead(input.message) ||
        parseContextualSearch(input.message, input.context) ||
        parseBrainQuestion(input.message);

      if (!parsed) {
        return fail(
          "VALIDATION_ERROR",
          "No pude clasificar la intencion empresarial del mensaje.",
        );
      }

      if (!registry.get(parsed.intentId)) {
        return fail(
          "MODULE_MISCONFIGURED",
          `La intencion ${parsed.intentId} no esta registrada.`,
        );
      }

      return ok(parsed);
    },
  };
}
