import type { UIMessage } from "ai";

export function hasBrainMessageContent(message: UIMessage) {
  return Boolean(message.id) && message.parts.some((part) =>
    part.type.startsWith("tool-") || (part.type === "text" && part.text.trim().length > 0),
  );
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return JSON.stringify(Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined).sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => [key, canonical(item)]),
  ));
  return JSON.stringify(value);
}

/** Trust server history. The browser may only add user text or decide a saved proposal. */
export function prepareIncomingBrainMessage(previous: UIMessage[], incoming: UIMessage) {
  if (incoming.role === "user") {
    if (!incoming.parts.length || incoming.parts.some((part) => part.type !== "text")) {
      throw new Error("Envía un mensaje de texto a Brain.");
    }
    const saved = previous.find((message) => message.id === incoming.id);
    if (saved && canonical(saved) !== canonical(incoming)) throw new Error("El mensaje original cambió. Envía uno nuevo.");
    return { message: incoming, decisions: [] as UIMessage["parts"] };
  }
  const saved = previous.at(-1);
  if (incoming.role !== "assistant" || saved?.role !== "assistant" || saved.id !== incoming.id || saved.parts.length !== incoming.parts.length) {
    throw new Error("La respuesta no corresponde a una propuesta pendiente de Brain.");
  }
  const decisions: UIMessage["parts"] = [];
  const parts = saved.parts.map((part, index) => {
    const candidate = incoming.parts[index];
    if (canonical(part) === canonical(candidate)) return part;
    const source = part as unknown as { state?: string; approval?: { id?: string } };
    const decision = candidate as unknown as { state?: string; approval?: { id?: string; approved?: boolean; reason?: string } };
    if (!part.type.startsWith("tool-") || source.state !== "approval-requested" || decision.state !== "approval-responded" ||
      !source.approval?.id || decision.approval?.id !== source.approval.id || typeof decision.approval.approved !== "boolean") {
      throw new Error("La propuesta fue alterada. Brain bloqueó su ejecución.");
    }
    const expected = { ...part, state: "approval-responded", approval: { ...source.approval, approved: decision.approval.approved, ...(decision.approval.reason ? { reason: decision.approval.reason } : {}) } };
    if (canonical(expected) !== canonical(candidate)) throw new Error("La propuesta fue alterada. Brain bloqueó su ejecución.");
    decisions.push(candidate);
    return expected as UIMessage["parts"][number];
  });
  if (!decisions.length) throw new Error("Esta propuesta ya fue procesada o no requiere aprobación.");
  return { message: { ...saved, parts }, decisions };
}
