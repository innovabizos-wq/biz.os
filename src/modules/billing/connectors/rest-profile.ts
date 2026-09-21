import { z } from "zod";

const relativePath = z.string().trim().min(1).max(300).superRefine((value, context) => {
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("#")) {
    context.addIssue({
      code: "custom",
      message: "Las rutas REST deben ser relativas, comenzar con / y no incluir fragmentos.",
    });
  }
});

const fieldPath = z.string().trim().regex(
  /^[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*){0,5}$/,
  "La ruta de respuesta solo puede contener nombres de campos separados por punto.",
);

function stringList(value: unknown) {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") return value.split(",");
  return [];
}

const statusValues = z.preprocess(
  stringList,
  z.array(z.string().trim().min(1).max(80)).min(1).max(20),
);

const restFiscalProfileSchema = z.object({
  acceptedValues: statusValues,
  baseUrl: z.string().trim().url().max(500),
  contractVersion: z.literal("bizos-fiscal-v1"),
  documentIdField: fieldPath,
  issuePath: relativePath,
  processingValues: statusValues,
  referenceField: fieldPath,
  rejectedValues: statusValues,
  statusField: fieldPath,
  statusPathTemplate: relativePath,
  verificationPath: relativePath,
}).superRefine((value, context) => {
  if ((value.statusPathTemplate.match(/\{reference\}/g) ?? []).length !== 1) {
    context.addIssue({
      code: "custom",
      path: ["statusPathTemplate"],
      message: "La ruta de estado debe contener {reference} exactamente una vez.",
    });
  }
  const groups = [value.acceptedValues, value.processingValues, value.rejectedValues]
    .map((items) => new Set(items.map((item) => item.toLowerCase())));
  if ([...groups[0]].some((item) => groups[1].has(item) || groups[2].has(item))
    || [...groups[1]].some((item) => groups[2].has(item))) {
    context.addIssue({
      code: "custom",
      path: ["statusField"],
      message: "Un estado REST no puede pertenecer a más de un resultado.",
    });
  }
});

export type RestFiscalProfile = z.infer<typeof restFiscalProfileSchema>;

export function parseRestFiscalProfile(value: Record<string, unknown>): RestFiscalProfile {
  return restFiscalProfileSchema.parse({
    acceptedValues: value.acceptedValues ?? "accepted,aceptado",
    baseUrl: value.baseUrl,
    contractVersion: value.contractVersion ?? "bizos-fiscal-v1",
    documentIdField: value.documentIdField ?? "documentId",
    issuePath: value.issuePath ?? "/fiscal-documents",
    processingValues: value.processingValues ?? "received,processing,recibido,procesando",
    referenceField: value.referenceField ?? "reference",
    rejectedValues: value.rejectedValues ?? "rejected,rechazado",
    statusField: value.statusField ?? "status",
    statusPathTemplate: value.statusPathTemplate ?? "/fiscal-documents/{reference}",
    verificationPath: value.verificationPath ?? "/fiscal-contract",
  });
}

export function responseField(payload: unknown, path: string) {
  let current: unknown = payload;
  for (const segment of path.split(".")) {
    if (!current || typeof current !== "object" || Array.isArray(current)) return null;
    current = (current as Record<string, unknown>)[segment];
  }
  return typeof current === "string" || typeof current === "number"
    ? String(current).trim() || null
    : null;
}

export function restProviderStatus(
  profile: RestFiscalProfile,
  payload: unknown,
): "accepted" | "processing" | "rejected" | "unknown" {
  const status = responseField(payload, profile.statusField)?.toLowerCase();
  if (!status) return "unknown";
  if (profile.acceptedValues.some((value) => value.toLowerCase() === status)) return "accepted";
  if (profile.rejectedValues.some((value) => value.toLowerCase() === status)) return "rejected";
  if (profile.processingValues.some((value) => value.toLowerCase() === status)) return "processing";
  return "unknown";
}
