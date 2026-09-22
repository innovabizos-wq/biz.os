import { getCurrentTenantContext, getCurrentUser } from "@/lib/auth/session";
import { hasAnyPermission, hasPermission } from "@/lib/permissions/permission-checks";
import { isModuleActive } from "@/lib/platform-modules/module-checks";
import { createClient } from "@/lib/supabase/server";
import { getDispatchOrders } from "@/modules/dispatch/queries";
import { dispatchMobileMetadataSchema } from "@/modules/dispatch/schemas";

const MAX_EVIDENCE_FILES = 4;
const MAX_EVIDENCE_FILE_BYTES = 6 * 1024 * 1024;
const MAX_REQUEST_BYTES = 26 * 1024 * 1024;
const ALLOWED_EVIDENCE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

type EvidenceKind = "photo" | "signature";

type PreparedOperationRow = {
  operation_status: "completed" | "incident" | "pending";
  result: Record<string, unknown> | null;
};

type CompletedOperationRow = {
  dispatch_status: string;
  operation_status: "completed" | "incident";
  replayed: boolean;
  result: Record<string, unknown> | null;
};

function apiError(code: string, message: string, status: number) {
  return Response.json({ code, message }, { status });
}

function extensionForMimeType(mimeType: string) {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  return "jpg";
}

function safeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "evidence";
}

function readEvidence(formData: FormData) {
  const evidence: Array<{ file: File; kind: EvidenceKind }> = [];
  for (const kind of ["photo", "signature"] as const) {
    for (const value of formData.getAll(kind)) {
      if (value instanceof File && value.size > 0) evidence.push({ file: value, kind });
    }
  }
  return evidence;
}

async function authorizeMobileDispatch() {
  const [userResult, tenantResult] = await Promise.all([
    getCurrentUser(),
    getCurrentTenantContext(),
  ]);

  if (!userResult.ok || !userResult.data || !tenantResult.ok || !tenantResult.data) {
    return { error: apiError("AUTH_NOT_CONNECTED", "Usuario autenticado requerido.", 401) } as const;
  }

  const tenant = tenantResult.data;
  if (
    !isModuleActive(tenant.activeModules, "mobile")
    || !hasPermission(tenant.permissions, "mobile.access")
  ) {
    return { error: apiError("MODULE_INACTIVE", "API movil no disponible.", 403) } as const;
  }

  if (
    !isModuleActive(tenant.activeModules, "dispatch")
    || !hasAnyPermission(tenant.permissions, [
      "dispatch.orders.view",
      "dispatch.orders.edit",
      "dispatch.orders.status.change",
      "driver.tracking.use",
    ])
  ) {
    return { error: apiError("PERMISSION_DENIED", "Despacho no disponible para este usuario.", 403) } as const;
  }

  return { tenant, user: userResult.data } as const;
}

export async function GET() {
  const authorization = await authorizeMobileDispatch();
  if ("error" in authorization) return authorization.error;
  const { tenant } = authorization;

  const dispatches = await getDispatchOrders(tenant, "todos");

  if (!dispatches.ok) {
    return Response.json(dispatches.error, { status: 403 });
  }

  return Response.json({
    data: dispatches.data
      .filter((dispatch) => (
        hasAnyPermission(tenant.permissions, ["dispatch.orders.create", "dispatch.orders.edit"])
        || dispatch.responsableId === null
        || dispatch.responsableId === tenant.profileId
      ))
      .map((dispatch) => ({
      clienteNombre: dispatch.clienteNombre,
      contactoEntrega: dispatch.contactoEntrega,
      direccionEntrega: dispatch.direccionEntrega,
      estado: dispatch.estado,
      fechaProgramada: dispatch.fechaProgramada,
      horaProgramada: dispatch.horaProgramada,
      id: dispatch.id,
      numero: dispatch.numero,
      responsableId: dispatch.responsableId,
      telefonoEntrega: dispatch.telefonoEntrega,
      ventaId: dispatch.ventaId,
    })),
  });
}

export async function POST(request: Request) {
  const authorization = await authorizeMobileDispatch();
  if ("error" in authorization) return authorization.error;
  const { tenant } = authorization;

  if (!hasPermission(tenant.permissions, "dispatch.orders.status.change")) {
    return apiError("PERMISSION_DENIED", "No puedes confirmar entregas.", 403);
  }

  const contentLength = Number(request.headers.get("content-length") || 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
    return apiError("REQUEST_TOO_LARGE", "La evidencia total supera el límite permitido.", 413);
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return apiError("INVALID_FORM", "No se pudo leer la operación móvil.", 400);
  }

  const parsed = dispatchMobileMetadataSchema.safeParse({
    accuracyMeters: formData.get("accuracyMeters") || undefined,
    capturedAt: formData.get("capturedAt"),
    dispatchId: formData.get("dispatchId"),
    latitude: formData.get("latitude") || undefined,
    longitude: formData.get("longitude") || undefined,
    operationId: formData.get("operationId"),
    receiverName: formData.get("receiverName") || undefined,
    result: formData.get("result") || undefined,
    targetStatus: formData.get("targetStatus"),
  });
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", "Los datos de entrega están incompletos.", 400);
  }

  const evidence = readEvidence(formData);
  if (evidence.length > MAX_EVIDENCE_FILES) {
    return apiError("TOO_MANY_FILES", "Puedes adjuntar hasta cuatro evidencias.", 400);
  }
  if (evidence.reduce((total, item) => total + item.file.size, 0) > 24 * 1024 * 1024) {
    return apiError("REQUEST_TOO_LARGE", "La evidencia total debe pesar 24 MB o menos.", 413);
  }
  if (parsed.data.targetStatus === "entregado" && evidence.length === 0) {
    return apiError("EVIDENCE_REQUIRED", "Adjunta al menos una foto o firma.", 400);
  }
  for (const item of evidence) {
    if (!ALLOWED_EVIDENCE_MIME_TYPES.has(item.file.type)) {
      return apiError("UNSUPPORTED_FILE", "Las evidencias deben ser JPG, PNG o WebP.", 415);
    }
    if (item.file.size > MAX_EVIDENCE_FILE_BYTES) {
      return apiError("FILE_TOO_LARGE", "Cada evidencia debe pesar 6 MB o menos.", 413);
    }
  }

  const manifest = evidence.map((item, index) => ({
    fileName: safeFileName(item.file.name),
    mimeType: item.file.type,
    sizeBytes: item.file.size,
    storagePath: [
      tenant.empresaId,
      parsed.data.dispatchId,
      parsed.data.operationId,
      `${item.kind}-${index + 1}.${extensionForMimeType(item.file.type)}`,
    ].join("/"),
    type: item.kind,
  }));

  const supabase = await createClient();
  const { data: preparedData, error: prepareError } = await supabase.rpc(
    "prepare_dispatch_mobile_operation",
    {
      p_accuracy_meters: parsed.data.accuracyMeters ?? null,
      p_captured_at: parsed.data.capturedAt,
      p_dispatch_id: parsed.data.dispatchId,
      p_evidence_manifest: manifest,
      p_latitude: parsed.data.latitude ?? null,
      p_longitude: parsed.data.longitude ?? null,
      p_operation_id: parsed.data.operationId,
      p_receiver_name: parsed.data.receiverName ?? null,
      p_result: parsed.data.result ?? null,
      p_target_status: parsed.data.targetStatus,
    },
  );
  if (prepareError) {
    const conflict = prepareError.code === "23505";
    return apiError(
      conflict ? "IDEMPOTENCY_CONFLICT" : "PREPARE_FAILED",
      conflict
        ? "Esta operación ya existe con datos diferentes."
        : prepareError.message || "No se pudo preparar la entrega.",
      conflict ? 409 : 400,
    );
  }

  const prepared = (preparedData as PreparedOperationRow[] | null)?.[0];
  if (prepared?.operation_status === "completed") {
    return Response.json({ data: prepared.result, replayed: true });
  }

  for (let index = 0; index < evidence.length; index += 1) {
    const item = evidence[index];
    const descriptor = manifest[index];
    const { error } = await supabase.storage
      .from("dispatch-evidence")
      .upload(descriptor.storagePath, await item.file.arrayBuffer(), {
        contentType: item.file.type,
        upsert: true,
      });
    if (error) {
      return apiError(
        "EVIDENCE_UPLOAD_FAILED",
        "La evidencia quedó pendiente de sincronizar. Intenta de nuevo con conexión estable.",
        502,
      );
    }
  }

  if (parsed.data.targetStatus === "entregado") {
    const { error: fulfillmentError } = await supabase.rpc(
      "record_dispatch_full_delivery",
      {
        p_dispatch_id: parsed.data.dispatchId,
        p_operation_id: parsed.data.operationId,
        p_receiver_name: parsed.data.receiverName ?? null,
        p_result: parsed.data.result ?? null,
      },
    );
    if (fulfillmentError) {
      return apiError(
        fulfillmentError.code === "23505" ? "IDEMPOTENCY_CONFLICT" : "FULFILLMENT_FAILED",
        fulfillmentError.message || "No se pudieron aplicar las cantidades entregadas.",
        fulfillmentError.code === "23505" ? 409 : 400,
      );
    }
  }

  const { data: completedData, error: completeError } = await supabase.rpc(
    "complete_dispatch_mobile_operation",
    { p_operation_id: parsed.data.operationId },
  );
  if (completeError) {
    return apiError(
      "COMPLETE_FAILED",
      completeError.message || "No se pudo completar la entrega.",
      409,
    );
  }

  const completed = (completedData as CompletedOperationRow[] | null)?.[0];
  if (!completed) {
    return apiError("EMPTY_RESULT", "La entrega no devolvió confirmación.", 502);
  }
  if (completed.operation_status === "incident") {
    return Response.json(
      {
        code: "SYNC_INCIDENT",
        data: completed.result,
        message: String(completed.result?.message || "La entrega requiere revisión."),
      },
      { status: 409 },
    );
  }

  return Response.json({
    data: completed.result,
    dispatchStatus: completed.dispatch_status,
    replayed: completed.replayed,
  });
}
