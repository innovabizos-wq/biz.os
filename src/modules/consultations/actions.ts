"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { hasPermission } from "@/lib/permissions/permission-checks";
import { createClient } from "@/lib/supabase/server";
import {
  consultationCustomerStepSchema,
  consultationSaveSchema,
  consultationSearchSchema,
} from "@/modules/consultations/schemas";
import {
  findCrmCustomerByDocument,
  getConsultationSearchResult,
} from "@/modules/consultations/queries";
import type { ConsultationSearchResult } from "@/modules/consultations/types";
import { createOwnNotificationAction } from "@/modules/notifications/actions";
import { requireAdminAccess } from "@/modules/tenant/admin-access";

type RpcError = {
  code?: string;
  details?: string;
  hint?: string;
  message?: string;
};

type CreatedCustomerRow = {
  cliente_id?: string;
};

export type ConsultationModalSearchState = {
  documento: string;
  message: string | null;
  result: ConsultationSearchResult | null;
  status: "idle" | "error" | "success";
};

export type ConsultationModalSaveState = {
  clienteId: string | null;
  intent: "quote" | "save" | null;
  message: string | null;
  status: "idle" | "error" | "success";
};

export type ConsultationCustomerStepState = {
  cliente: {
    clienteId: string;
    correo?: string;
    direccion?: string;
    documento: string;
    nombre: string;
    origen: string;
    source: "hacienda" | "internal" | "manual";
    telefono?: string;
    tipo: "cliente" | "prospecto";
    whatsapp?: string;
  } | null;
  message: string | null;
  status: "idle" | "error" | "success";
};

function getFormData(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

function redirectWithError(path: string, message: string): never {
  const separator = path.includes("?") ? "&" : "?";

  redirect(`${path}${separator}error=${encodeURIComponent(message)}`);
}

function getReturnTo(formData: FormData): "/consultas/nueva" | "/dashboard" {
  return formData.get("returnTo") === "/dashboard" ? "/dashboard" : "/consultas/nueva";
}

function buildSearchRedirectPath(
  returnTo: "/consultas/nueva" | "/dashboard",
  documento?: string,
) {
  const params = new URLSearchParams();

  if (returnTo === "/dashboard") {
    params.set("consulta", "nueva");
  }

  if (documento) {
    params.set("documento", documento);
  }

  const query = params.toString();

  return query ? `${returnTo}?${query}` : returnTo;
}

function buildSavedRedirectPath() {
  return "/dashboard?consulta_estado=saved";
}

function safeErrorMessage(error: RpcError) {
  const message = error.message?.replace(/\s+/g, " ").trim();

  if (!message) return "No se pudo completar la accion.";

  if (message.includes("Permiso") || message.includes("permission")) {
    return "No tienes permiso para completar esta accion.";
  }

  if (message.includes("duplicate key") || message.includes("already exists")) {
    return "Ya existe un registro con esos datos.";
  }

  if (message.includes("current_empresa_id") || message.includes("empresa_id")) {
    return "No pudimos validar la empresa activa. Vuelve a iniciar sesion.";
  }

  return message;
}

function logConsultationActionError(
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

function buildCustomerNotes(input: {
  direccion?: string;
  regimen?: string;
  situacion?: string;
  tipoIdentificacion?: string;
}) {
  const lines = [
    input.direccion ? `Direccion: ${input.direccion}` : null,
    input.tipoIdentificacion
      ? `Tipo identificacion Hacienda: ${input.tipoIdentificacion}`
      : null,
    input.regimen ? `Regimen Hacienda: ${input.regimen}` : null,
    input.situacion ? `Situacion Hacienda: ${input.situacion}` : null,
  ].filter(Boolean);

  return lines.length > 0 ? lines.join("\n") : null;
}

function buildInteractionSummary(input: {
  descripcionGestion: string;
  documento: string;
  intent: "quote" | "save";
  source: "hacienda" | "internal" | "manual";
}) {
  const prefix =
    input.intent === "quote"
      ? "Nueva consulta con intencion de cotizar"
      : "Nueva consulta";

  return `${prefix} desde dashboard.\nDocumento: ${input.documento}\nOrigen: ${input.source}\n\n${input.descripcionGestion}`;
}

function revalidateConsultationPaths(clienteId?: string) {
  revalidatePath("/dashboard");
  revalidatePath("/consultas/nueva");
  revalidatePath("/crm");
  revalidatePath("/crm/clientes");

  if (clienteId) {
    revalidatePath(`/crm/clientes/${clienteId}`);
  }

  revalidatePath("/cotizaciones");
  revalidatePath("/cotizaciones/nueva");
}

export async function searchConsultationSubjectAction(formData: FormData) {
  const returnTo = getReturnTo(formData);
  const parsed = consultationSearchSchema.safeParse(getFormData(formData));

  if (!parsed.success) {
    redirectWithError(
      buildSearchRedirectPath(returnTo),
      "La identificacion debe tener entre 9 y 12 digitos numericos.",
    );
  }

  const access = await requireAdminAccess();

  if (!hasPermission(access.tenant.permissions, "crm.customers.view")) {
    redirectWithError(
      "/dashboard",
      "Solicita acceso al administrador para buscar clientes.",
    );
  }

  redirect(buildSearchRedirectPath(returnTo, parsed.data.documento));
}

export async function searchConsultationSubjectModalAction(
  _previousState: ConsultationModalSearchState,
  formData: FormData,
): Promise<ConsultationModalSearchState> {
  const parsed = consultationSearchSchema.safeParse(getFormData(formData));

  if (!parsed.success) {
    return {
      documento: "",
      message: "La identificacion debe tener entre 9 y 12 digitos numericos.",
      result: null,
      status: "error",
    };
  }

  const access = await requireAdminAccess();

  if (!hasPermission(access.tenant.permissions, "crm.customers.view")) {
    return {
      documento: parsed.data.documento,
      message: "Solicita acceso al administrador para buscar clientes.",
      result: null,
      status: "error",
    };
  }

  const searchResult = await getConsultationSearchResult(
    access.tenant,
    parsed.data.documento,
  );

  if (!searchResult.ok) {
    return {
      documento: parsed.data.documento,
      message: "No se pudo completar la busqueda. Intenta de nuevo.",
      result: {
        documento: parsed.data.documento,
        message: "Completa la informacion para iniciar una gestion.",
        source: "manual",
      },
      status: "error",
    };
  }

  return {
    documento: parsed.data.documento,
    message: null,
    result: searchResult.data,
    status: "success",
  };
}

export async function saveConsultationAction(formData: FormData) {
  const returnTo = getReturnTo(formData);
  const parsed = consultationSaveSchema.safeParse(getFormData(formData));

  if (!parsed.success) {
    redirectWithError(buildSearchRedirectPath(returnTo), "Completa los datos requeridos.");
  }

  const access = await requireAdminAccess();

  if (!hasPermission(access.tenant.permissions, "crm.interactions.create")) {
    redirectWithError(
      buildSearchRedirectPath(returnTo, parsed.data.documento),
      "No tienes permiso para registrar gestiones. Solicita acceso al administrador.",
    );
  }

  let clienteId = parsed.data.clienteId;
  const supabase = await createClient();

  if (clienteId) {
    const { data, error } = await supabase
      .from("crm_clientes")
      .select("id")
      .eq("empresa_id", access.tenant.empresaId)
      .eq("id", clienteId)
      .maybeSingle<{ id: string }>();

    if (error || !data) {
      redirectWithError(
        buildSearchRedirectPath(returnTo, parsed.data.documento),
        "No se pudo validar el cliente.",
      );
    }
  }

  if (!clienteId) {
    const existing = await findCrmCustomerByDocument(
      access.tenant,
      parsed.data.documento,
    );

    if (existing.ok && existing.data) {
      clienteId = existing.data.id;
    }
  }

  if (!clienteId) {
    if (!hasPermission(access.tenant.permissions, "crm.customers.create")) {
      redirectWithError(
        buildSearchRedirectPath(returnTo, parsed.data.documento),
        "No tienes permiso para crear clientes.",
      );
    }

    const { data, error } = await supabase.rpc("crear_crm_cliente", {
      p_asignado_a: null,
      p_correo: parsed.data.correo ?? null,
      p_genero: "o",
      p_identificacion: parsed.data.documento,
      p_nombre: parsed.data.nombre,
      p_notas: buildCustomerNotes({
        direccion: parsed.data.direccion,
        regimen: parsed.data.regimen,
        situacion: parsed.data.situacion,
        tipoIdentificacion: parsed.data.tipoIdentificacion,
      }),
      p_origen: parsed.data.origen ?? "nueva_consulta",
      p_telefono: parsed.data.telefono ?? null,
      p_tipo: parsed.data.tipo,
      p_whatsapp: parsed.data.whatsapp ?? null,
    });

    if (error) {
      logConsultationActionError("saveConsultationAction.createCustomer", error, {
        documento: parsed.data.documento,
      });
      redirectWithError(
        buildSearchRedirectPath(returnTo, parsed.data.documento),
        `No se pudo crear el cliente: ${safeErrorMessage(error)}`,
      );
    }

    clienteId = (data as CreatedCustomerRow[] | null)?.[0]?.cliente_id;
  }

  if (!clienteId) {
    redirectWithError(
      buildSearchRedirectPath(returnTo, parsed.data.documento),
      "No se pudo preparar el cliente.",
    );
  }

  const { error: interactionError } = await supabase.rpc("crear_crm_interaccion", {
    p_cliente_id: clienteId,
    p_resultado:
      parsed.data.interaccionResultado ??
      (parsed.data.intent === "quote"
        ? "Gestion guardada. Cotizacion iniciada desde registro rapido."
        : "Gestion registrada desde registro rapido."),
    p_resumen: buildInteractionSummary({
      descripcionGestion: parsed.data.descripcionGestion,
      documento: parsed.data.documento,
      intent: parsed.data.intent,
      source: parsed.data.source,
    }),
    p_tipo: parsed.data.interaccionTipo,
  });

  if (interactionError) {
    logConsultationActionError("saveConsultationAction.createInteraction", interactionError, {
      clienteId,
    });
    redirectWithError(
      buildSearchRedirectPath(returnTo, parsed.data.documento),
      `No se pudo guardar la gestion: ${safeErrorMessage(interactionError)}`,
    );
  }

  await createOwnNotificationAction({
    entityId: clienteId,
    entityType: "crm_customer",
    href: `/crm/clientes/${clienteId}`,
    message: "La gestion se guardo correctamente.",
    metadata: {
      intent: parsed.data.intent,
      source: "new_consultation",
    },
    title: "Gestion guardada",
    type: "success",
  });

  revalidateConsultationPaths(clienteId);

  if (parsed.data.intent === "quote") {
    redirect(`/cotizaciones/nueva?clienteId=${clienteId}`);
  }

  redirect(buildSavedRedirectPath());
}

export async function saveConsultationModalAction(
  _previousState: ConsultationModalSaveState,
  formData: FormData,
): Promise<ConsultationModalSaveState> {
  const parsed = consultationSaveSchema.safeParse(getFormData(formData));

  if (!parsed.success) {
    return {
      clienteId: null,
      intent: null,
      message: "Completa los datos requeridos.",
      status: "error",
    };
  }

  const access = await requireAdminAccess();

  if (!hasPermission(access.tenant.permissions, "crm.interactions.create")) {
    return {
      clienteId: null,
      intent: parsed.data.intent,
      message:
        "No tienes permiso para registrar gestiones. Solicita acceso al administrador.",
      status: "error",
    };
  }

  let clienteId = parsed.data.clienteId;
  const supabase = await createClient();

  if (clienteId) {
    const { data, error } = await supabase
      .from("crm_clientes")
      .select("id")
      .eq("empresa_id", access.tenant.empresaId)
      .eq("id", clienteId)
      .maybeSingle<{ id: string }>();

    if (error || !data) {
      return {
        clienteId: null,
        intent: parsed.data.intent,
        message: "No se pudo validar el cliente.",
        status: "error",
      };
    }
  }

  if (!clienteId) {
    const existing = await findCrmCustomerByDocument(
      access.tenant,
      parsed.data.documento,
    );

    if (existing.ok && existing.data) {
      clienteId = existing.data.id;
    }
  }

  if (!clienteId) {
    if (!hasPermission(access.tenant.permissions, "crm.customers.create")) {
      return {
        clienteId: null,
        intent: parsed.data.intent,
        message: "No tienes permiso para crear clientes.",
        status: "error",
      };
    }

    const { data, error } = await supabase.rpc("crear_crm_cliente", {
      p_asignado_a: null,
      p_correo: parsed.data.correo ?? null,
      p_genero: "o",
      p_identificacion: parsed.data.documento,
      p_nombre: parsed.data.nombre,
      p_notas: buildCustomerNotes({
        direccion: parsed.data.direccion,
        regimen: parsed.data.regimen,
        situacion: parsed.data.situacion,
        tipoIdentificacion: parsed.data.tipoIdentificacion,
      }),
      p_origen: parsed.data.origen ?? "nueva_consulta",
      p_telefono: parsed.data.telefono ?? null,
      p_tipo: parsed.data.tipo,
      p_whatsapp: parsed.data.whatsapp ?? null,
    });

    if (error) {
      logConsultationActionError(
        "saveConsultationModalAction.createCustomer",
        error,
        {
          documento: parsed.data.documento,
        },
      );

      return {
        clienteId: null,
        intent: parsed.data.intent,
        message: `No se pudo crear el cliente: ${safeErrorMessage(error)}`,
        status: "error",
      };
    }

    clienteId = (data as CreatedCustomerRow[] | null)?.[0]?.cliente_id;
  }

  if (!clienteId) {
    return {
      clienteId: null,
      intent: parsed.data.intent,
      message: "No se pudo preparar el cliente.",
      status: "error",
    };
  }

  const { error: interactionError } = await supabase.rpc("crear_crm_interaccion", {
    p_cliente_id: clienteId,
    p_resultado:
      parsed.data.interaccionResultado ??
      (parsed.data.intent === "quote"
        ? "Gestion guardada. Cotizacion iniciada desde registro rapido."
        : "Gestion registrada desde registro rapido."),
    p_resumen: buildInteractionSummary({
      descripcionGestion: parsed.data.descripcionGestion,
      documento: parsed.data.documento,
      intent: parsed.data.intent,
      source: parsed.data.source,
    }),
    p_tipo: parsed.data.interaccionTipo,
  });

  if (interactionError) {
    logConsultationActionError(
      "saveConsultationModalAction.createInteraction",
      interactionError,
      {
        clienteId,
      },
    );

    return {
      clienteId,
      intent: parsed.data.intent,
      message: `No se pudo guardar la gestion: ${safeErrorMessage(interactionError)}`,
      status: "error",
    };
  }

  await createOwnNotificationAction({
    entityId: clienteId,
    entityType: "crm_customer",
    href: `/crm/clientes/${clienteId}`,
    message: "La gestion se guardo correctamente.",
    metadata: {
      intent: parsed.data.intent,
      source: "new_consultation",
    },
    title: "Gestion guardada",
    type: "success",
  });

  revalidateConsultationPaths(clienteId);

  return {
    clienteId,
    intent: parsed.data.intent,
    message:
      parsed.data.intent === "quote"
        ? "Gestion guardada. Abriendo nueva cotizacion."
        : "Gestion guardada correctamente.",
    status: "success",
  };
}

export async function createConsultationCustomerModalAction(
  _previousState: ConsultationCustomerStepState,
  formData: FormData,
): Promise<ConsultationCustomerStepState> {
  const parsed = consultationCustomerStepSchema.safeParse(getFormData(formData));

  if (!parsed.success) {
    return {
      cliente: null,
      message: "Completa los datos del cliente antes de continuar.",
      status: "error",
    };
  }

  const access = await requireAdminAccess();

  const supabase = await createClient();
  let clienteId = parsed.data.clienteId;
  let source: "hacienda" | "internal" | "manual" = parsed.data.source;

  if (!clienteId) {
    const existing = await findCrmCustomerByDocument(
      access.tenant,
      parsed.data.documento,
    );

    if (existing.ok && existing.data) {
      clienteId = existing.data.id;
      source = "internal";
    }
  }

  if (!clienteId) {
    if (!hasPermission(access.tenant.permissions, "crm.customers.create")) {
      return {
        cliente: null,
        message: "No tienes permiso para crear clientes.",
        status: "error",
      };
    }

    const { data, error } = await supabase.rpc("crear_crm_cliente", {
      p_asignado_a: null,
      p_correo: parsed.data.correo ?? null,
      p_genero: "o",
      p_identificacion: parsed.data.documento,
      p_nombre: parsed.data.nombre,
      p_notas: buildCustomerNotes({
        direccion: parsed.data.direccion,
        regimen: parsed.data.regimen,
        situacion: parsed.data.situacion,
        tipoIdentificacion: parsed.data.tipoIdentificacion,
      }),
      p_origen: parsed.data.origen,
      p_telefono: parsed.data.telefono ?? null,
      p_tipo: parsed.data.tipo,
      p_whatsapp: parsed.data.whatsapp ?? null,
    });

    if (error) {
      logConsultationActionError(
        "createConsultationCustomerModalAction.createCustomer",
        error,
        { documento: parsed.data.documento },
      );

      return {
        cliente: null,
        message: `No se pudo crear el cliente: ${safeErrorMessage(error)}`,
        status: "error",
      };
    }

    clienteId = (data as CreatedCustomerRow[] | null)?.[0]?.cliente_id;
  }

  if (!clienteId) {
    return {
      cliente: null,
      message: "No se pudo preparar el cliente.",
      status: "error",
    };
  }

  revalidateConsultationPaths(clienteId);

  return {
    cliente: {
      clienteId,
      correo: parsed.data.correo,
      direccion: parsed.data.direccion,
      documento: parsed.data.documento,
      nombre: parsed.data.nombre,
      origen: parsed.data.origen,
      source,
      telefono: parsed.data.telefono,
      tipo: parsed.data.tipo,
      whatsapp: parsed.data.whatsapp,
    },
    message: "Cliente guardado. Continua con la descripcion de la gestion.",
    status: "success",
  };
}
