import "server-only";

import { createHash } from "node:crypto";

import { createClient } from "@/lib/supabase/server";

const MAX_RESPONSE_XML_BYTES = 2_000_000;

function decodeOfficialResponse(value: string) {
  const normalized = value.replace(/\s+/g, "");
  if (!normalized || !/^[A-Za-z0-9+/]+={0,2}$/.test(normalized)) {
    throw new Error("Hacienda devolvió una respuesta XML con Base64 inválido.");
  }
  const content = Buffer.from(normalized, "base64");
  if (!content.length || content.length > MAX_RESPONSE_XML_BYTES) {
    throw new Error("La respuesta XML oficial está vacía o supera 2 MB.");
  }
  const xml = content.toString("utf8");
  if (/<!DOCTYPE|<!ENTITY/i.test(xml) || !/<(?:[\w-]+:)?MensajeHacienda\b/.test(xml)) {
    throw new Error("La respuesta final de Hacienda no contiene un XML MensajeHacienda seguro.");
  }
  return xml;
}

export async function archiveOfficialHaciendaResponseXml(input: {
  empresaId: string;
  fiscalDocumentId: string;
  generatedBy: string;
  responseXmlBase64?: string;
}) {
  if (!input.responseXmlBase64) return null;
  const contentText = decodeOfficialResponse(input.responseXmlBase64);
  const sha256 = createHash("sha256").update(contentText).digest("hex");
  const storagePath = [
    "billing",
    input.empresaId,
    "fiscal-documents",
    input.fiscalDocumentId,
    "hacienda-official-response.xml",
  ].join("/");
  const supabase = await createClient();
  const { data: existing, error: lookupError } = await supabase
    .from("fiscal_document_artifacts")
    .select("id")
    .eq("empresa_id", input.empresaId)
    .eq("fiscal_document_id", input.fiscalDocumentId)
    .eq("artifact_type", "hacienda_response")
    .eq("sha256", sha256)
    .maybeSingle<{ id: string }>();
  if (lookupError) throw new Error("No se pudo comprobar el archivo oficial de Hacienda.");
  if (!existing) {
    const { error } = await supabase.from("fiscal_document_artifacts").insert({
      artifact_type: "hacienda_response",
      content_mime_type: "application/xml",
      content_text: contentText,
      empresa_id: input.empresaId,
      fiscal_document_id: input.fiscalDocumentId,
      metadata: {
        generatedAt: new Date().toISOString(),
        generatedBy: input.generatedBy,
        phase: "official-status-xml",
        signedByHacienda: true,
      },
      sha256,
      status: "stored",
      storage_path: storagePath,
    });
    if (error) throw new Error("No se pudo archivar el XML oficial firmado por Hacienda.");
  }
  return storagePath;
}
