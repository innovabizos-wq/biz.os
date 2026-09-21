export const CONVERSATION_LAYER_SAFETY_CONTRACT = [
  "No ejecutes acciones.",
  "No inventes clientes, productos, precios, CABYS, datos fiscales ni documentos.",
  "Si una accion coincide parcialmente con varias opciones, usa safe_to_execute: false.",
  "Para facturacion, pagos, inventario, clientes o documentos fiscales, usa safe_to_execute: false hasta que el backend valide.",
].join("\n");

export {
  BRAIN_CONVERSATION_NATURALIZE_PROMPT,
  BRAIN_CONVERSATION_ROUTER_PROMPT,
} from "@/modules/brain/brain-prompts";
