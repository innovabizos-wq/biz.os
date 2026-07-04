import "server-only";

type LocalParsedAction = {
  actionId: string;
  confidence: number;
  params: Record<string, unknown>;
};

type LocalParserContext = {
  currentModule?: unknown;
  currentPath?: unknown;
};

const CREATE_CUSTOMER_PATTERNS = [
  "crear cliente",
  "crea cliente",
  "crear un cliente",
  "crea un cliente",
  "crees cliente",
  "crees un cliente",
  "registrar cliente",
  "registre cliente",
  "registre un cliente",
  "registrar un cliente",
  "agregar cliente",
  "agrega cliente",
  "agregue cliente",
  "agregar un cliente",
  "agrega un cliente",
  "agregue un cliente",
  "nuevo cliente",
  "cliente nuevo",
  "dar de alta cliente",
];

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\w\s@.+-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripPrefix(original: string) {
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
    .replace(/^crear cliente\s+/i, "")
    .replace(/^(?:crea|crear|crees) un cliente(?: que se llame)?\s+/i, "")
    .replace(/^(?:crea|crear|crees) cliente(?: que se llame)?\s+/i, "")
    .replace(/^registre(?: un)? cliente(?: que se llame)?\s+/i, "")
    .replace(/^registrar(?: un)? cliente(?: que se llame)?\s+/i, "")
    .replace(/^agregue(?: un)? cliente(?: que se llame)?\s+/i, "")
    .replace(/^agrega(?: un)? cliente(?: que se llame)?\s+/i, "")
    .replace(/^agregar(?: un)? cliente(?: que se llame)?\s+/i, "")
    .replace(/^nuevo cliente\s+/i, "")
    .replace(/^cliente nuevo\s+/i, "")
    .trim();
}

function firstMatch(value: string, pattern: RegExp) {
  return value.match(pattern)?.[1]?.trim();
}

function extractBeforeLabels(value: string) {
  return value
    .split(
      /\b(?:con\s+)?(?:correo|email|mail|cedula|c[eé]dula|ced|id|identificacion|identificaci[oó]n|cc|numero|n[uú]mero|telefono|tel[eé]fono|tel|cel|whatsapp)\b/i,
    )[0]
    ?.replace(/\bque se llame\b/i, "")
    .replace(/\bse llame\b/i, "")
    .replace(/\bcon\b$/i, "")
    .trim();
}

function parseCreateCustomer(message: string): LocalParsedAction | null {
  const normalized = normalize(message);
  const hasCreateIntent = CREATE_CUSTOMER_PATTERNS.some((pattern) =>
    normalized.includes(pattern),
  );
  const hasRegisterPersonIntent = /^(registre|registrar|agregue|agregar) a\b/.test(
    normalized,
  );

  if (!hasCreateIntent && !hasRegisterPersonIntent) return null;

  const email = firstMatch(message, /\b[\w.+-]+@[\w.-]+\.\w+\b/i);
  const identificacion = firstMatch(
    message,
    /\b(?:cedula|c[eé]dula|ced|id|identificacion|identificaci[oó]n|cc)\s*[:#-]?\s*([0-9-]{6,20})\b/i,
  )?.replace(/\D/g, "");
  const whatsapp = firstMatch(
    message,
    /\b(?:whatsapp|WhatsApp)\s*[:#-]?\s*([0-9\s-]{7,20})\b/,
  )?.replace(/\D/g, "");
  const telefono = (
    whatsapp ||
    firstMatch(
      message,
      /\b(?:numero|n[uú]mero|telefono|tel[eé]fono|tel|cel)\s*[:#-]?\s*([0-9\s-]{7,20})\b/i,
    )
  )?.replace(/\D/g, "");
  const explicitName = firstMatch(
    message,
    /\b(?:nombre|llamado|llamada|se llama)\s*[:#-]?\s*([A-Za-zÀ-ÿ\s.'-]{2,80}?)(?=\s*,?\s*(?:cedula|c[eé]dula|ced|id|identificacion|identificación|cc|numero|n[uú]mero|telefono|tel[eé]fono|tel|cel|whatsapp|correo|email|mail)\b|$)/i,
  );
  const nameCandidate = explicitName ?? extractBeforeLabels(stripPrefix(message));
  const nombre = nameCandidate && normalize(nameCandidate) !== "cliente"
    ? nameCandidate
    : undefined;

  return {
    actionId: "clientes.crear_cliente",
    confidence: nombre ? 0.96 : 0.72,
    params: {
      correo: email,
      genero: "o",
      identificacion,
      nombre,
      telefono,
      tipo: "prospecto",
      whatsapp,
    },
  };
}

function parseSearch(message: string): LocalParsedAction | null {
  const normalized = normalize(message);

  const customerMatch = normalized.match(/\b(?:busca|buscar|encuentra|encontrar)\s+(?:cliente|clientes)\s+(.+)$/);
  if (customerMatch?.[1]) {
    return {
      actionId: "clientes.buscar_cliente",
      confidence: 0.9,
      params: { limit: 8, query: customerMatch[1].trim() },
    };
  }

  const productMatch = normalized.match(/\b(?:busca|buscar|encuentra|encontrar)\s+(?:producto|productos|servicio|servicios)\s+(.+)$/);
  if (productMatch?.[1]) {
    return {
      actionId: "productos.buscar_producto",
      confidence: 0.9,
      params: { limit: 8, query: productMatch[1].trim() },
    };
  }

  const stockMatch = normalized.match(/\b(?:stock|inventario|existencias)\s+(?:de\s+)?(.+)$/);
  if (stockMatch?.[1]) {
    return {
      actionId: "inventario.consultar_stock",
      confidence: 0.86,
      params: { limit: 8, query: stockMatch[1].trim() },
    };
  }

  return null;
}

function parseCreateProduct(message: string): LocalParsedAction | null {
  const normalized = normalize(message);
  if (!/\b(crear|crea|agregar|agregue|nuevo)\s+(un\s+)?(producto|servicio)\b/.test(normalized)) {
    return null;
  }

  const price = firstMatch(message, /\bprecio\s*[:#-]?\s*([0-9]+(?:[.,][0-9]+)?)\b/i);
  const name = message
    .replace(/^.*?\b(?:producto|servicio)\b/i, "")
    .split(/\bprecio\b/i)[0]
    ?.trim();

  return {
    actionId: "productos.crear_producto",
    confidence: name ? 0.86 : 0.62,
    params: {
      moneda: "CRC",
      nombre: name || undefined,
      precioBase: price ? Number(price.replace(",", ".")) : 0,
      tipo: normalized.includes("servicio") ? "servicio" : "producto",
      unidadMedida: "unidad",
    },
  };
}

function parseCreateAutoblog(message: string): LocalParsedAction | null {
  const normalized = normalize(message);
  if (!/\b(crear|crea|generar|genera|escribir|escribe)\s+(un\s+)?(blog|articulo|articulo de blog|post)\b/.test(normalized)) {
    return null;
  }

  const topic =
    firstMatch(message, /\b(?:sobre|acerca de|de)\s+(.+)$/i) ||
    message
      .replace(/^.*?\b(?:blog|articulo|post)\b/i, "")
      .replace(/^\s*(?:sobre|acerca de|de)\s+/i, "")
      .trim();

  return {
    actionId: "autoblog.generar_articulo",
    confidence: topic ? 0.92 : 0.68,
    params: {
      sourceMode: "internal_context",
      topic: topic || undefined,
    },
  };
}

function parseBrainQuestion(message: string): LocalParsedAction | null {
  const normalized = normalize(message);

  // Ejecutar análisis completo del Brain
  if (
    /\b(analiza|analizar)\s+(mi\s+)?negocio\b/.test(normalized) ||
    /\b(ejecuta|actualiza|corre)\s+(el\s+)?brain\b/.test(normalized)
  ) {
    return {
      actionId: "brain.generar_analisis",
      confidence: 0.92,
      params: { question: message },
    };
  }

  // Preguntas estratégicas y operativas — van al Brain
  if (
    // Prioridades y urgencias
    /\bque\s+(debo|tengo)\s+(atender|hacer)\s+hoy\b/.test(normalized) ||
    /\bprioridades?\b/.test(normalized) ||
    /\burgente\b/.test(normalized) ||
    /\bmas\s+importante\b/.test(normalized) ||
    /\bque\s+hago\s+primero\b/.test(normalized) ||
    /\bpor\s+donde\s+empez(ar|o)\b/.test(normalized) ||

    // Ventas
    /\bque\s+esta\s+pasando\s+con\s+mis\s+ventas\b/.test(normalized) ||
    /\b(resumen|reporte|analisis)\s+(de\s+)?(las\s+)?ventas\b/.test(normalized) ||
    /\bcomo\s+van\s+(las\s+)?ventas\b/.test(normalized) ||
    /\bcomo\s+estoy\s+en\s+ventas\b/.test(normalized) ||

    // Flujo de caja y finanzas
    /\bflujo\s+de\s+caja\b/.test(normalized) ||
    /\bcobros?\s+(vencidos?|pendientes?)\b/.test(normalized) ||
    /\bcuentas?\s+por\s+cobrar\b/.test(normalized) ||
    /\bfinancieramente\b/.test(normalized) ||
    /\bliquidez\b/.test(normalized) ||
    /\bdinero\b/.test(normalized) ||

    // Clientes
    /\bclientes?\s+en\s+riesgo\b/.test(normalized) ||
    /\bseguimientos?\s+vencidos?\b/.test(normalized) ||
    /\bcomo\s+(estan|van)\s+(mis\s+)?clientes?\b/.test(normalized) ||

    // Inventario y compras
    /\bproductos?\s+(debo|tengo)\s+comprar\b/.test(normalized) ||
    /\bque\s+productos?\s+comprar\b/.test(normalized) ||
    /\bstock\s+bajo\b/.test(normalized) ||
    /\binventario\s+bajo\b/.test(normalized) ||

    // Estado general del negocio
    /\bcomo\s+va\s+(mi\s+)?negocio\b/.test(normalized) ||
    /\bcomo\s+estoy\b/.test(normalized) ||
    /\bque\s+(tipo|clase)\s+de\s+negocio\b/.test(normalized) ||
    /\bcual\s+es\s+mi\s+sector\b/.test(normalized) ||
    /\ben\s+que\s+(tipo|clase)\s+de\s+negocio\b/.test(normalized) ||
    /\bmi\s+sector\b/.test(normalized) ||

    // Recomendaciones y decisiones
    /\bque\s+(me\s+)?(recomiendas?|sugieres?|aconsejas?)\b/.test(normalized) ||
    /\bque\s+debo\s+hacer\b/.test(normalized) ||
    /\bsolo\s+puedo\s+hacer\s+una\s+cosa\b/.test(normalized) ||
    /\bsi\s+solo\s+pudiera\b/.test(normalized) ||
    /\buna\s+sola\s+accion\b/.test(normalized) ||
    /\bmejorar\s+el\s+flujo\b/.test(normalized) ||
    /\bque\s+me\s+falta\b/.test(normalized) ||
    /\bque\s+esta\s+mal\b/.test(normalized) ||
    /\bcomo\s+mejorar\b/.test(normalized)
  ) {
    return {
      actionId: "brain.responder_pregunta",
      confidence: 0.92,
      params: { question: message },
    };
  }

  return null;
}

function getContextModule(context?: LocalParserContext) {
  const currentModule =
    typeof context?.currentModule === "string" ? context.currentModule : "";
  const currentPath =
    typeof context?.currentPath === "string" ? context.currentPath : "";
  const value = normalize(`${currentModule} ${currentPath}`);

  if (value.includes("catalog") || value.includes("catalogo")) return "catalog";
  if (value.includes("crm") || value.includes("cliente")) return "crm";
  if (value.includes("inventario") || value.includes("inventory")) return "inventory";
  if (value.includes("cotizacion") || value.includes("quotes")) return "quotes";
  if (value.includes("facturacion") || value.includes("billing")) return "billing";

  return null;
}

function parseContextualSearch(
  message: string,
  context?: LocalParserContext,
): LocalParsedAction | null {
  const query = message.trim();
  const normalized = normalize(query);

  if (
    normalized.length < 3 ||
    /^(si|sí|no|ok|confirmar|cancelar|abrir|ir a)\b/.test(normalized)
  ) {
    return null;
  }

  const contextModule = getContextModule(context);

  if (contextModule === "catalog") {
    return {
      actionId: "productos.buscar_producto",
      confidence: 0.84,
      params: { limit: 8, query },
    };
  }

  if (contextModule === "crm") {
    return {
      actionId: "clientes.buscar_cliente",
      confidence: 0.84,
      params: { limit: 8, query },
    };
  }

  if (contextModule === "inventory") {
    return {
      actionId: "inventario.consultar_stock",
      confidence: 0.84,
      params: { limit: 8, query },
    };
  }

  return null;
}

export function parseLocalConversationAction(
  message: string,
  context?: LocalParserContext,
): LocalParsedAction | null {
  return (
    parseBrainQuestion(message) ||
    parseCreateAutoblog(message) ||
    parseCreateCustomer(message) ||
    parseCreateProduct(message) ||
    parseSearch(message) ||
    parseContextualSearch(message, context)
  );
}
