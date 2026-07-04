import { quoteModalItemSchema, quoteModalItemsSchema } from "@/modules/quotes/schemas";

export function getQuoteModalItemsValidationMessage(items: unknown) {
  const parsed = quoteModalItemsSchema.safeParse(items);

  if (parsed.success) return null;

  const firstIssue = parsed.error.issues[0];
  const field = firstIssue?.path.at(-1);

  if (!Array.isArray(items) || items.length === 0) {
    return "Agrega al menos un item antes de crear la cotizacion.";
  }

  if (field === "descripcion") return "Agrega una descripcion para el item.";
  if (field === "cantidad") return "La cantidad debe ser mayor a 0.";
  if (field === "precioUnitario") return "El precio debe ser mayor a 0.";

  return "Revisa los items antes de crear la cotizacion.";
}

export function getQuoteModalItemValidationMessage(input: unknown) {
  if (Array.isArray(input)) {
    return getQuoteModalItemsValidationMessage(input);
  }

  const parsed = quoteModalItemSchema.safeParse(input);

  if (parsed.success) return null;

  const field = parsed.error.issues[0]?.path.at(-1);

  if (field === "descripcion") return "Agrega una descripcion para el item.";
  if (field === "cantidad") return "La cantidad debe ser mayor a 0.";
  if (field === "precioUnitario") return "El precio debe ser mayor a 0.";

  return "Revisa los datos del item.";
}
