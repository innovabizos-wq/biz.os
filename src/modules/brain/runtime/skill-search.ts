type SearchableSkill = {
  description: string;
  enabled: boolean;
  id: string;
  kind: string;
  module: string;
  name: string;
};

type SkillSearchInput<TSkill extends SearchableSkill> = {
  currentModule?: string | null;
  limit?: number;
  message: string;
  skills: TSkill[];
};

const STOP_WORDS = new Set([
  "a", "al", "algo", "con", "de", "del", "desde", "el", "en", "esto",
  "favor", "haz", "la", "las", "lo", "los", "me", "mi", "para", "por",
  "puedes", "que", "quiero", "se", "un", "una", "y",
]);

const SEMANTIC_GROUPS = [
  ["cliente", "clientes", "crm", "prospecto", "prospectos"],
  ["producto", "productos", "catalogo", "articulo", "servicio"],
  ["inventario", "stock", "existencia", "existencias", "bodega"],
  ["cotizacion", "cotizaciones", "presupuesto", "oferta", "quotes"],
  ["venta", "ventas", "pedido", "orden", "sales"],
  ["cobro", "cobros", "cobrar", "cuenta", "receivable", "payments"],
  ["pago", "pagos", "pagar", "proveedor", "payable"],
  ["compra", "compras", "abastecimiento", "reorden", "purchases"],
  ["mensaje", "mensajes", "chat", "conversacion", "inbox", "whatsapp"],
  ["tarea", "tareas", "seguimiento", "recordatorio", "agenda"],
  ["factura", "facturacion", "fiscal", "billing"],
  ["despacho", "despachos", "entrega", "logistica", "dispatch"],
  ["blog", "articulo", "contenido", "autoblog"],
  ["abrir", "ver", "llevar", "ir", "navegar"],
  ["buscar", "encontrar", "localizar", "consultar"],
  ["crear", "registrar", "agregar", "nuevo", "preparar"],
  ["editar", "actualizar", "cambiar", "modificar"],
  ["eliminar", "borrar", "cancelar", "anular", "cerrar"],
  ["vencido", "vencidos", "atrasado", "moroso", "expirado"],
  ["abierto", "abiertos", "pendiente", "pendientes", "pipeline"],
  ["resumen", "total", "cuanto", "cuantos", "cantidad", "sumar"],
];

const SEMANTIC_INDEX = new Map<string, string[]>();
for (const group of SEMANTIC_GROUPS) {
  for (const token of group) SEMANTIC_INDEX.set(token, group);
}

export function normalizeBrainSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(value: string) {
  const base = normalizeBrainSearchText(value)
    .split(" ")
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
  const expanded = new Set(base);
  for (const token of base) {
    for (const synonym of SEMANTIC_INDEX.get(token) ?? []) expanded.add(synonym);
  }
  return [...expanded];
}

function scoreSkill(skill: SearchableSkill, tokens: string[], message: string) {
  const id = normalizeBrainSearchText(skill.id);
  const name = normalizeBrainSearchText(skill.name);
  const description = normalizeBrainSearchText(skill.description);
  let score = 0;

  for (const token of tokens) {
    if (id.split(" ").includes(token)) score += 8;
    else if (id.includes(token)) score += 5;
    if (name.split(" ").includes(token)) score += 6;
    else if (name.includes(token)) score += 3;
    if (description.split(" ").includes(token)) score += 4;
    else if (description.includes(token)) score += 2;
  }

  if (message.includes("cuant") || message.includes("total") || message.includes("resumen")) {
    if (["query", "analysis"].includes(skill.kind)) score += 5;
  }
  if (/\b(crea|crear|registra|registrar|agrega|prepara)\b/.test(message)) {
    if (["command", "draft"].includes(skill.kind)) score += 6;
  }
  if (/\b(busca|buscar|encuentra|consulta|dime|muestra)\b/.test(message)) {
    if (skill.kind === "query") score += 5;
  }

  return score;
}

const ALWAYS_AVAILABLE = new Set([
  "brain.context.open",
  "brain.question.answer",
  "brain.signals.query",
]);

export function rankBusinessSkills<TSkill extends SearchableSkill>({
  currentModule,
  limit = 18,
  message,
  skills,
}: SkillSearchInput<TSkill>): TSkill[] {
  const normalizedMessage = normalizeBrainSearchText(message);
  const tokens = tokenize(message);
  const ranked = skills
    .filter((skill) => skill.enabled)
    .map((skill) => ({
      score:
        scoreSkill(skill, tokens, normalizedMessage) +
        (currentModule && skill.module === currentModule ? 7 : 0),
      skill,
    }))
    .sort((left, right) =>
      right.score - left.score || left.skill.id.localeCompare(right.skill.id),
    );

  const selected = ranked
    .filter((candidate) => candidate.score > 0 || ALWAYS_AVAILABLE.has(candidate.skill.id))
    .slice(0, Math.max(1, limit))
    .map((candidate) => candidate.skill);

  for (const skill of skills) {
    if (
      ALWAYS_AVAILABLE.has(skill.id) &&
      skill.enabled &&
      !selected.some((candidate) => candidate.id === skill.id)
    ) {
      selected.push(skill);
    }
  }

  return selected.slice(0, Math.max(3, limit));
}

export function toSafeToolName(skillId: string) {
  const normalized = skillId.replace(/[^a-zA-Z0-9_-]/g, "_");
  let hash = 5381;
  for (const character of skillId) {
    hash = ((hash << 5) + hash) ^ character.charCodeAt(0);
  }
  const suffix = (hash >>> 0).toString(36).padStart(7, "0").slice(-7);
  return `${`biz_${normalized}`.slice(0, 55)}_${suffix}`;
}
