"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { hasPermission } from "@/lib/permissions/permission-checks";
import {
  addQuoteItemSchema,
  changeQuoteStatusSchema,
  createQuoteSchema,
  deleteQuoteItemSchema,
  quoteIdActionSchema,
  quoteModalItemSchema,
  quoteModalItemsSchema,
  type QuoteModalItemInput,
  updateQuoteItemSchema,
  updateQuoteSchema,
} from "@/modules/quotes/schemas";
import { requireAdminAccess } from "@/modules/tenant/admin-access";

type RpcError = {
  code?: string;
  details?: string;
  hint?: string;
  message?: string;
};

type CreatedQuoteRow = {
  cotizacion_id?: string;
  numero?: string;
};

type ModalQuoteItem = {
  cantidad: number;
  descripcion: string;
  descuento: number;
  impuestoMonto: number;
  impuestoPorcentaje: number;
  precioUnitario: number;
  productoId: string | null;
  subtotal: number;
  total: number;
};

function parseQuoteModalItems(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value.trim()) {
    return quoteModalItemsSchema.safeParse([]);
  }

  try {
    return quoteModalItemsSchema.safeParse(JSON.parse(value));
  } catch {
    return quoteModalItemsSchema.safeParse([]);
  }
}

function parseQuoteModalItemsForMessage(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value.trim()) return [];

  try {
    return JSON.parse(value) as unknown;
  } catch {
    return [];
  }
}

function getQuoteItemsValidationMessage(items: unknown) {
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

function getQuoteItemValidationMessage(input: unknown) {
  const parsed = quoteModalItemSchema.safeParse(input);

  if (parsed.success) return null;

  const field = parsed.error.issues[0]?.path.at(-1);

  if (field === "descripcion") return "Agrega una descripcion para el item.";
  if (field === "cantidad") return "La cantidad debe ser mayor a 0.";
  if (field === "precioUnitario") return "El precio debe ser mayor a 0.";

  return "Revisa los datos del item.";
}

function mapQuoteItemsForRpc(items: QuoteModalItemInput[]) {
  return items.map((item, index) => ({
    cantidad: item.cantidad,
    descripcion: item.descripcion,
    descuento: item.descuento,
    impuesto_porcentaje: item.impuestoPorcentaje,
    orden: index + 1,
    precio_unitario: item.precioUnitario,
    producto_id: item.productoId ?? null,
  }));
}

export type CreateQuoteModalState = {
  cotizacionId: string | null;
  message: string | null;
  numero: string | null;
  status: "idle" | "error" | "success";
};

export type AddQuoteItemModalState = {
  item: ModalQuoteItem | null;
  message: string | null;
  status: "error" | "success";
};

function getFormData(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

function redirectWithError(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

function safeErrorMessage(error: RpcError) {
  const message = error.message?.replace(/\s+/g, " ").trim();

  if (!message) return "No se pudo completar la accion.";
  if (message.includes("Permiso") || message.toLowerCase().includes("permission")) {
    return "No tienes permiso para completar esta accion.";
  }
  if (
    message.toLowerCase().includes("column reference") ||
    message.toLowerCase().includes("ambiguous")
  ) {
    return "No se pudo completar la accion por una regla interna de base de datos. Revisa las migraciones pendientes o solicita ayuda tecnica.";
  }
  if (message.includes("duplicate key") || message.includes("Ya existe")) {
    return "Ya existe un registro relacionado.";
  }
  if (message.includes("estado")) return message;

  return message;
}

function logQuoteActionError(
  actionName: string,
  error: RpcError,
  context: Record<string, string>,
) {
  if (process.env.NODE_ENV !== "production") {
    console.error(`[${actionName}] Supabase RPC error`, {
      code: error.code,
      context,
      details: error.details,
      hint: error.hint,
      message: error.message,
    });
  }
}

function revalidateQuotePaths(cotizacionId?: string, clienteId?: string) {
  revalidatePath("/cotizaciones");
  revalidatePath("/cotizaciones/nueva");

  if (cotizacionId) {
    revalidatePath(`/cotizaciones/${cotizacionId}`);
  }

  if (clienteId) {
    revalidatePath(`/crm/clientes/${clienteId}`);
  }
}

async function assertQuotePermission(permission: "quotes.create" | "quotes.edit" | "quotes.status.change") {
  const access = await requireAdminAccess();

  if (!hasPermission(access.tenant.permissions, permission)) {
    redirectWithError("/cotizaciones", "No tienes permiso para realizar esta acción.");
  }

  return access;
}

async function querySaleForQuote(cotizacionId: string, empresaId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("ventas")
    .select("id, estado")
    .eq("empresa_id", empresaId)
    .eq("cotizacion_id", cotizacionId)
    .maybeSingle<{ id: string; estado: string }>();

  return data ?? null;
}

export async function createQuoteAction(formData: FormData) {
  const parsed = createQuoteSchema.safeParse(getFormData(formData));

  if (!parsed.success) {
    redirectWithError("/cotizaciones/nueva", "Datos de cotizacion invalidos.");
  }

  await assertQuotePermission("quotes.create");
  redirectWithError(
    "/cotizaciones/nueva",
    "Agrega al menos un item antes de crear la cotizacion.",
  );
}

export async function createQuoteModalAction(
  _previousState: CreateQuoteModalState,
  formData: FormData,
): Promise<CreateQuoteModalState> {
  const parsed = createQuoteSchema.safeParse(getFormData(formData));
  const parsedItems = parseQuoteModalItems(formData.get("itemsJson"));

  if (!parsed.success || !parsedItems.success) {
    if (process.env.NODE_ENV !== "production") {
      const itemsForMessage = parseQuoteModalItemsForMessage(formData.get("itemsJson"));
      console.warn("[createQuoteModalAction] invalid quote payload", {
        hasQuoteData: parsed.success,
        itemsCount: Array.isArray(itemsForMessage) ? itemsForMessage.length : null,
        itemsValid: parsedItems.success,
      });
    }

    return {
      cotizacionId: null,
      message: !parsedItems.success
        ? getQuoteItemsValidationMessage(
            parseQuoteModalItemsForMessage(formData.get("itemsJson")),
          )
        : "Datos de cotizacion invalidos.",
      numero: null,
      status: "error",
    };
  }

  const access = await requireAdminAccess();

  if (!hasPermission(access.tenant.permissions, "quotes.create")) {
    return {
      cotizacionId: null,
      message: "No tienes permiso para crear cotizaciones.",
      numero: null,
      status: "error",
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("crear_cotizacion", {
    p_cliente_id: parsed.data.clienteId ?? null,
    p_condiciones: parsed.data.condiciones ?? null,
    p_fecha_vencimiento: parsed.data.fechaVencimiento ?? null,
    p_items: mapQuoteItemsForRpc(parsedItems.data),
    p_moneda: parsed.data.moneda,
    p_notas: parsed.data.notas ?? null,
  });

  if (error) {
    logQuoteActionError("createQuoteModalAction", error, {
      clienteId: parsed.data.clienteId ?? "none",
    });

    return {
      cotizacionId: null,
      message: `No se pudo crear la cotizacion: ${safeErrorMessage(error)}`,
      numero: null,
      status: "error",
    };
  }

  const createdQuote = (data as CreatedQuoteRow[] | null)?.[0];
  const cotizacionId = createdQuote?.cotizacion_id ?? null;

  revalidateQuotePaths(cotizacionId ?? undefined, parsed.data.clienteId);

  return {
    cotizacionId,
    message: "Cotizacion creada correctamente.",
    numero: createdQuote?.numero ?? null,
    status: "success",
  };
}

export async function createQuoteDraftModalAction(): Promise<CreateQuoteModalState> {
  const access = await requireAdminAccess();

  if (!hasPermission(access.tenant.permissions, "quotes.create")) {
    return {
      cotizacionId: null,
      message: "No tienes permiso para crear cotizaciones.",
      numero: null,
      status: "error",
    };
  }

  return {
    cotizacionId: null,
    message: "Agrega al menos un item antes de crear la cotizacion.",
    numero: null,
    status: "error",
  };
}

export async function addQuoteItemModalAction(
  formData: FormData,
): Promise<AddQuoteItemModalState> {
  const parsed = addQuoteItemSchema.safeParse(getFormData(formData));

  if (!parsed.success) {
    return {
      item: null,
      message: "Completa los datos del item.",
      status: "error",
    };
  }

  const access = await requireAdminAccess();

  if (!hasPermission(access.tenant.permissions, "quotes.edit")) {
    return {
      item: null,
      message: "No tienes permiso para editar cotizaciones.",
      status: "error",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("agregar_item_cotizacion", {
    p_cantidad: parsed.data.cantidad,
    p_cotizacion_id: parsed.data.cotizacionId,
    p_descripcion: parsed.data.descripcion,
    p_descuento: parsed.data.descuento,
    p_impuesto_porcentaje: parsed.data.impuestoPorcentaje,
    p_precio_unitario: parsed.data.precioUnitario,
    p_producto_id: parsed.data.productoId ?? null,
  });

  if (error) {
    logQuoteActionError("addQuoteItemModalAction", error, {
      cotizacionId: parsed.data.cotizacionId,
    });

    return {
      item: null,
      message: `No se pudo agregar el item: ${safeErrorMessage(error)}`,
      status: "error",
    };
  }

  const subtotal = parsed.data.cantidad * parsed.data.precioUnitario;
  const taxableAmount = Math.max(subtotal - parsed.data.descuento, 0);
  const impuestoMonto = taxableAmount * (parsed.data.impuestoPorcentaje / 100);
  const total = taxableAmount + impuestoMonto;

  revalidateQuotePaths(parsed.data.cotizacionId);

  return {
    item: {
      cantidad: parsed.data.cantidad,
      descripcion: parsed.data.descripcion,
      descuento: parsed.data.descuento,
      impuestoMonto,
      impuestoPorcentaje: parsed.data.impuestoPorcentaje,
      precioUnitario: parsed.data.precioUnitario,
      productoId: parsed.data.productoId ?? null,
      subtotal,
      total,
    },
    message: "Item agregado.",
    status: "success",
  };
}

export async function updateQuoteAction(formData: FormData) {
  const parsed = updateQuoteSchema.safeParse(getFormData(formData));

  if (!parsed.success) {
    redirectWithError("/cotizaciones", "Datos de cotizacion invalidos.");
  }

  await assertQuotePermission("quotes.edit");

  const supabase = await createClient();
  const { error } = await supabase.rpc("actualizar_cotizacion", {
    p_cliente_id: parsed.data.clienteId ?? null,
    p_condiciones: parsed.data.condiciones ?? null,
    p_cotizacion_id: parsed.data.cotizacionId,
    p_fecha_vencimiento: parsed.data.fechaVencimiento ?? null,
    p_moneda: parsed.data.moneda,
    p_notas: parsed.data.notas ?? null,
  });

  if (error) {
    logQuoteActionError("updateQuoteAction", error, {
      cotizacionId: parsed.data.cotizacionId,
    });
    redirectWithError(
      "/cotizaciones",
      `No se pudo actualizar la cotizacion: ${safeErrorMessage(error)}`,
    );
  }

  revalidateQuotePaths(parsed.data.cotizacionId, parsed.data.clienteId);
  redirect("/cotizaciones?success=Cotizacion%20actualizada.");
}

export async function addQuoteItemAction(formData: FormData) {
  const parsed = addQuoteItemSchema.safeParse(getFormData(formData));

  if (!parsed.success) {
    redirectWithError(
      "/cotizaciones",
      getQuoteItemValidationMessage(getFormData(formData)) ?? "Datos de item invalidos.",
    );
  }

  await assertQuotePermission("quotes.edit");

  const supabase = await createClient();
  const { error } = await supabase.rpc("agregar_item_cotizacion", {
    p_cantidad: parsed.data.cantidad,
    p_cotizacion_id: parsed.data.cotizacionId,
    p_descripcion: parsed.data.descripcion,
    p_descuento: parsed.data.descuento,
    p_impuesto_porcentaje: parsed.data.impuestoPorcentaje,
    p_precio_unitario: parsed.data.precioUnitario,
    p_producto_id: parsed.data.productoId ?? null,
  });

  if (error) {
    logQuoteActionError("addQuoteItemAction", error, {
      cotizacionId: parsed.data.cotizacionId,
    });
    redirectWithError(
      "/cotizaciones",
      `No se pudo agregar el item: ${safeErrorMessage(error)}`,
    );
  }

  revalidateQuotePaths(parsed.data.cotizacionId);
  redirect("/cotizaciones?success=Item%20agregado.");
}

export async function updateQuoteItemAction(formData: FormData) {
  const parsed = updateQuoteItemSchema.safeParse(getFormData(formData));
  const cotizacionId = String(formData.get("cotizacionId") ?? "");

  if (!parsed.success || !cotizacionId) {
    redirectWithError(
      "/cotizaciones",
      getQuoteItemValidationMessage(getFormData(formData)) ?? "Datos de item invalidos.",
    );
  }

  await assertQuotePermission("quotes.edit");

  const supabase = await createClient();
  const { error } = await supabase.rpc("actualizar_item_cotizacion", {
    p_cantidad: parsed.data.cantidad,
    p_descripcion: parsed.data.descripcion,
    p_descuento: parsed.data.descuento,
    p_impuesto_porcentaje: parsed.data.impuestoPorcentaje,
    p_item_id: parsed.data.itemId,
    p_precio_unitario: parsed.data.precioUnitario,
    p_producto_id: parsed.data.productoId ?? null,
  });

  if (error) {
    logQuoteActionError("updateQuoteItemAction", error, {
      itemId: parsed.data.itemId,
    });
    redirectWithError(
      "/cotizaciones",
      `No se pudo actualizar el item: ${safeErrorMessage(error)}`,
    );
  }

  revalidateQuotePaths(cotizacionId);
  redirect("/cotizaciones?success=Item%20actualizado.");
}

export async function deleteQuoteItemAction(formData: FormData) {
  const parsed = deleteQuoteItemSchema.safeParse(getFormData(formData));
  const cotizacionId = parsed.success ? parsed.data.cotizacionId : undefined;

  if (!parsed.success || !cotizacionId) {
    redirectWithError("/cotizaciones", "Datos de item invalidos.");
  }

  await assertQuotePermission("quotes.edit");

  const supabase = await createClient();
  const { error } = await supabase.rpc("eliminar_item_cotizacion", {
    p_item_id: parsed.data.itemId,
  });

  if (error) {
    logQuoteActionError("deleteQuoteItemAction", error, {
      itemId: parsed.data.itemId,
    });
    redirectWithError(
      "/cotizaciones",
      `No se pudo eliminar el item: ${safeErrorMessage(error)}`,
    );
  }

  revalidateQuotePaths(cotizacionId);
  redirect("/cotizaciones?success=Item%20eliminado.");
}

export async function changeQuoteStatusAction(formData: FormData) {
  const parsed = changeQuoteStatusSchema.safeParse(getFormData(formData));

  if (!parsed.success) {
    redirectWithError("/cotizaciones", "Estado de cotizacion invalido.");
  }

  await assertQuotePermission("quotes.status.change");

  const supabase = await createClient();
  const { error } = await supabase.rpc("cambiar_estado_cotizacion", {
    p_cotizacion_id: parsed.data.cotizacionId,
    p_estado: parsed.data.estado,
  });

  if (error) {
    logQuoteActionError("changeQuoteStatusAction", error, {
      cotizacionId: parsed.data.cotizacionId,
      estado: parsed.data.estado,
    });
    redirectWithError(
      `/cotizaciones/${parsed.data.cotizacionId}`,
      `No se pudo cambiar el estado: ${safeErrorMessage(error)}`,
    );
  }

  revalidateQuotePaths(parsed.data.cotizacionId);
  redirect(`/cotizaciones/${parsed.data.cotizacionId}`);
}

export async function confirmSaleFromQuoteAction(formData: FormData) {
  const parsed = quoteIdActionSchema.safeParse(getFormData(formData));

  if (!parsed.success) {
    redirectWithError("/cotizaciones", "Cotizacion invalida.");
  }

  const access = await requireAdminAccess();
  const requiredPermissions = [
    "quotes.status.change",
    "sales.orders.create",
    "sales.orders.status.change",
  ] as const;
  const missingPermission = requiredPermissions.find(
    (permission) => !hasPermission(access.tenant.permissions, permission),
  );

  if (missingPermission) {
    redirectWithError(
      "/cotizaciones",
      "No tienes permiso para confirmar ventas desde cotizaciones.",
    );
  }

  const supabase = await createClient();
  const { data: quote, error: quoteError } = await supabase
    .from("cotizaciones")
    .select("id, cliente_id, estado")
    .eq("empresa_id", access.tenant.empresaId)
    .eq("id", parsed.data.cotizacionId)
    .maybeSingle<{ cliente_id: string | null; estado: string; id: string }>();

  if (quoteError || !quote) {
    redirectWithError("/cotizaciones", "No se encontro la cotizacion.");
  }

  if (["rechazada", "vencida", "anulada"].includes(quote.estado)) {
    redirectWithError(
      "/cotizaciones",
      "Esta cotizacion no puede convertirse en venta por su estado actual.",
    );
  }

  const { count: itemCount, error: itemCountError } = await supabase
    .from("cotizacion_items")
    .select("id", { count: "exact", head: true })
    .eq("empresa_id", access.tenant.empresaId)
    .eq("cotizacion_id", quote.id);

  if (itemCountError || !itemCount) {
    redirectWithError(
      "/cotizaciones",
      "No pudimos confirmar la venta porque la cotizacion no tiene items guardados.",
    );
  }

  if (quote.estado === "borrador") {
    const { error } = await supabase.rpc("cambiar_estado_cotizacion", {
      p_cotizacion_id: quote.id,
      p_estado: "enviada",
    });

    if (error) {
      redirectWithError("/cotizaciones", `No se pudo enviar la cotizacion: ${safeErrorMessage(error)}`);
    }
  }

  if (quote.estado !== "aceptada") {
    const { error } = await supabase.rpc("cambiar_estado_cotizacion", {
      p_cotizacion_id: quote.id,
      p_estado: "aceptada",
    });

    if (error) {
      redirectWithError("/cotizaciones", `No se pudo aceptar la cotizacion: ${safeErrorMessage(error)}`);
    }
  }

  let sale = await querySaleForQuote(quote.id, access.tenant.empresaId);

  if (!sale) {
    const { error } = await supabase.rpc("generar_venta_desde_cotizacion", {
      p_cotizacion_id: quote.id,
    });

    if (error && error.code !== "23505") {
      redirectWithError("/cotizaciones", `No se pudo generar la venta: ${safeErrorMessage(error)}`);
    }

    sale = await querySaleForQuote(quote.id, access.tenant.empresaId);
  }

  if (!sale) {
    redirectWithError("/cotizaciones", "La venta no pudo confirmarse.");
  }

  if (sale.estado === "cancelada") {
    redirectWithError("/cotizaciones", "La venta asociada esta cancelada.");
  }

  if (sale.estado === "nueva") {
    const { error } = await supabase.rpc("cambiar_estado_venta", {
      p_estado: "confirmada",
      p_venta_id: sale.id,
    });

    if (error) {
      redirectWithError("/cotizaciones", `No se pudo confirmar la venta: ${safeErrorMessage(error)}`);
    }
  }

  revalidateQuotePaths(quote.id, quote.cliente_id ?? undefined);
  revalidatePath("/ventas");
  revalidatePath(`/ventas/${sale.id}`);
  redirect("/cotizaciones?success=Venta%20confirmada.%20Ahora%20puedes%20emitir%20factura.");
}

export async function deleteQuoteAction(formData: FormData) {
  const parsed = quoteIdActionSchema.safeParse(getFormData(formData));

  if (!parsed.success) {
    redirectWithError("/cotizaciones", "Cotizacion invalida.");
  }

  const access = await requireAdminAccess();

  if (
    !hasPermission(access.tenant.permissions, "admin.settings.manage") &&
    !hasPermission(access.tenant.permissions, "admin.roles.manage")
  ) {
    redirectWithError(
      "/cotizaciones",
      "Solo un administrador puede eliminar cotizaciones.",
    );
  }

  const supabase = await createClient();
  const existingSale = await querySaleForQuote(
    parsed.data.cotizacionId,
    access.tenant.empresaId,
  );

  if (existingSale) {
    redirectWithError(
      "/cotizaciones",
      "Esta cotizacion ya tiene una venta asociada. No se puede eliminar; si necesitas corregirla, anula la venta o crea una nueva cotizacion.",
    );
  }

  const { error } = await supabase.rpc("eliminar_cotizacion_segura", {
    p_cotizacion_id: parsed.data.cotizacionId,
  });

  if (error) {
    logQuoteActionError("deleteQuoteAction", error, {
      cotizacionId: parsed.data.cotizacionId,
    });
    redirectWithError(
      "/cotizaciones",
      `No se pudo eliminar la cotizacion: ${safeErrorMessage(error)}`,
    );
  }

  revalidateQuotePaths(parsed.data.cotizacionId);
  redirect("/cotizaciones?success=Cotizacion%20eliminada.");
}
