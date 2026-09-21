import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/admin";
import { decryptSecret } from "@/modules/billing/crypto";
import { signXmlWithPkcs12 } from "@/modules/billing/signing/pkcs12";
import type { BillingXmlSigner, BillingXmlSignerInput } from "@/modules/billing/signing/types";

type SignerSecrets = { certificateBase64: string; pin: string };

function parseJsonRecord(value: string | null) {
  if (!value) return {} as Record<string, unknown>;
  const parsed = JSON.parse(value) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {} as Record<string, unknown>;
  return parsed as Record<string, unknown>;
}

function stringValue(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "string" && value ? value : null;
}

async function getSignerSecrets(empresaId: string, connectionId: string): Promise<SignerSecrets> {
  const supabase = createServiceRoleClient();
  const { data: connection, error: connectionError } = await supabase
    .from("company_fiscal_connections")
    .select("encrypted_credentials")
    .eq("id", connectionId)
    .eq("empresa_id", empresaId)
    .eq("provider_code", "hacienda")
    .neq("status", "disabled")
    .maybeSingle<{ encrypted_credentials: string | null }>();
  if (connectionError) throw new Error(`No se pudo cargar el certificado fiscal: ${connectionError.message}`);

  if (connection?.encrypted_credentials) {
    const credentials = parseJsonRecord(decryptSecret(connection.encrypted_credentials));
    const certificateBase64 = stringValue(credentials, "certificateBase64");
    const pin = stringValue(credentials, "certificatePin");
    if (certificateBase64 && pin) return { certificateBase64, pin };
  }
  throw new Error("La conexión Hacienda asignada requiere certificado .p12 y PIN.");
}

export class HaciendaPkcs12BillingXmlSigner implements BillingXmlSigner {
  async sign(input: BillingXmlSignerInput) {
    const secrets = await getSignerSecrets(input.empresaId, input.connectionId);
    return signXmlWithPkcs12({ ...secrets, unsignedXml: input.unsignedXml });
  }
}

export function getBillingXmlSigner(): BillingXmlSigner {
  return new HaciendaPkcs12BillingXmlSigner();
}
