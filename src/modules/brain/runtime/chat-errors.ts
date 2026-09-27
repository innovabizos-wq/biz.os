/** Safe, actionable messages. Never forward provider bodies or credentials to the browser. */
export function brainChatFailure(error: unknown): { code: string; message: string } {
  const value = error && typeof error === "object" ? error as { statusCode?: number; name?: string; message?: string; lastError?: unknown } : {};
  if (value.lastError && value.lastError !== error) return brainChatFailure(value.lastError);
  const status = value.statusCode;
  const message = value.message ?? "";
  if (status === 401 || status === 403) return { code: "PROVIDER_AUTH", message: "El proveedor de IA rechazó el acceso. Un administrador debe verificar la conexión de Brain en Configuración → IA." };
  if (status === 429) return { code: "PROVIDER_LIMIT", message: "El proveedor de IA alcanzó su límite de uso. Espera un momento; si continúa, revisa la cuota de la conexión de Brain." };
  if (status === 400 || /schema|tool.*valid|parameter/i.test(message)) return { code: "PROVIDER_REQUEST", message: "Brain no pudo preparar las herramientas para esta solicitud. El fallo quedó registrado para revisión. Revisa cualquier acción que ya aparezca como completada." };
  if (/timeout|abort/i.test(value.name ?? "")) return { code: "TIMEOUT", message: "Brain agotó el tiempo disponible. Revisa los resultados que sí aparecieron antes de reintentar una acción." };
  return { code: "CHAT_FAILED", message: "Brain no pudo completar la respuesta. Puedes reintentar; revisa primero cualquier acción que ya aparezca como completada." };
}
