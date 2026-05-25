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
  const code = error.code?.trim();

  return message && code ? `${message} (${code})` : (message ?? "Error RPC.");
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

export async function createQuoteAction(formData: FormData) {
  const parsed = createQuoteSchema.safeParse(getFormData(formData));

  if (!parsed.success) {
    redirectWithError("/cotizaciones/nueva", "Datos de cotizacion invalidos.");
  }

  await assertQuotePermission("quotes.create");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("crear_cotizacion", {
    p_cliente_id: parsed.data.clienteId ?? null,
    p_condiciones: parsed.data.condiciones ?? null,
    p_fecha_vencimiento: parsed.data.fechaVencimiento ?? null,
    p_items: [],
    p_moneda: parsed.data.moneda,
    p_notas: parsed.data.notas ?? null,
  });

  if (error) {
    logQuoteActionError("createQuoteAction", error, {
      clienteId: parsed.data.clienteId ?? "none",
    });
    redirectWithError(
      "/cotizaciones/nueva",
      `No se pudo crear la cotizacion: ${safeErrorMessage(error)}`,
    );
  }

  const cotizacionId = (data as CreatedQuoteRow[] | null)?.[0]?.cotizacion_id;

  revalidateQuotePaths(cotizacionId, parsed.data.clienteId);
  redirect(cotizacionId ? `/cotizaciones/${cotizacionId}` : "/cotizaciones");
}

export async function createQuoteModalAction(
  _previousState: CreateQuoteModalState,
  formData: FormData,
): Promise<CreateQuoteModalState> {
  const parsed = createQuoteSchema.safeParse(getFormData(formData));

  if (!parsed.success) {
    return {
      cotizacionId: null,
      message: "Datos de cotizacion invalidos.",
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
    p_items: [],
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

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("crear_cotizacion", {
    p_cliente_id: null,
    p_condiciones: null,
    p_fecha_vencimiento: null,
    p_items: [],
    p_moneda: "CRC",
    p_notas: null,
  });

  if (error) {
    logQuoteActionError("createQuoteDraftModalAction", error, {
      clienteId: "none",
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

  revalidateQuotePaths(cotizacionId ?? undefined);

  return {
    cotizacionId,
    message: "Cotizacion creada correctamente.",
    numero: createdQuote?.numero ?? null,
    status: "success",
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
      `/cotizaciones/${parsed.data.cotizacionId}`,
      `No se pudo actualizar la cotizacion: ${safeErrorMessage(error)}`,
    );
  }

  revalidateQuotePaths(parsed.data.cotizacionId, parsed.data.clienteId);
  redirect(`/cotizaciones/${parsed.data.cotizacionId}`);
}

export async function addQuoteItemAction(formData: FormData) {
  const parsed = addQuoteItemSchema.safeParse(getFormData(formData));

  if (!parsed.success) {
    redirectWithError("/cotizaciones", "Datos de item invalidos.");
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
      `/cotizaciones/${parsed.data.cotizacionId}`,
      `No se pudo agregar el item: ${safeErrorMessage(error)}`,
    );
  }

  revalidateQuotePaths(parsed.data.cotizacionId);
  redirect(`/cotizaciones/${parsed.data.cotizacionId}`);
}

export async function updateQuoteItemAction(formData: FormData) {
  const parsed = updateQuoteItemSchema.safeParse(getFormData(formData));
  const cotizacionId = String(formData.get("cotizacionId") ?? "");

  if (!parsed.success || !cotizacionId) {
    redirectWithError("/cotizaciones", "Datos de item invalidos.");
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
      `/cotizaciones/${cotizacionId}`,
      `No se pudo actualizar el item: ${safeErrorMessage(error)}`,
    );
  }

  revalidateQuotePaths(cotizacionId);
  redirect(`/cotizaciones/${cotizacionId}`);
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
      `/cotizaciones/${cotizacionId}`,
      `No se pudo eliminar el item: ${safeErrorMessage(error)}`,
    );
  }

  revalidateQuotePaths(cotizacionId);
  redirect(`/cotizaciones/${cotizacionId}`);
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
