import { getCurrentTenantContext, getCurrentUser } from "@/lib/auth/session";
import { hasAnyPermission } from "@/lib/permissions/permission-checks";
import { createClient } from "@/lib/supabase/server";

type DispatchEvidenceRouteProps = {
  params: Promise<{ evidenceId: string }>;
};

type EvidenceRow = {
  file_name: string | null;
  mime_type: string;
  storage_path: string;
};

function safeFileName(value: string | null, mimeType: string) {
  const extension = mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";
  return (value || `evidencia.${extension}`).replace(/[^a-zA-Z0-9._-]/g, "_");
}

export async function GET(_request: Request, { params }: DispatchEvidenceRouteProps) {
  const [{ evidenceId }, userResult, tenantResult] = await Promise.all([
    params,
    getCurrentUser(),
    getCurrentTenantContext(),
  ]);
  if (!userResult.ok || !userResult.data || !tenantResult.ok || !tenantResult.data) {
    return new Response("Usuario autenticado requerido.", { status: 401 });
  }
  if (!hasAnyPermission(tenantResult.data.permissions, [
    "dispatch.orders.view",
    "dispatch.orders.status.change",
  ])) {
    return new Response("Acceso denegado.", { status: 403 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("dispatch_delivery_evidence")
    .select("storage_path, mime_type, file_name")
    .eq("empresa_id", tenantResult.data.empresaId)
    .eq("id", evidenceId)
    .maybeSingle<EvidenceRow>();
  if (error || !data) return new Response("Evidencia no encontrada.", { status: 404 });

  const { data: file, error: downloadError } = await supabase.storage
    .from("dispatch-evidence")
    .download(data.storage_path);
  if (downloadError || !file) return new Response("Archivo no disponible.", { status: 404 });

  return new Response(await file.arrayBuffer(), {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": `inline; filename="${safeFileName(data.file_name, data.mime_type)}"`,
      "Content-Type": data.mime_type,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
