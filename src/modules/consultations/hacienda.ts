import { haciendaDocumentSchema } from "@/modules/consultations/schemas";
import type { HaciendaActivity, HaciendaLookupResult } from "@/modules/consultations/types";

const HACIENDA_ENDPOINT = "https://api.hacienda.go.cr/fe/ae";
const SUCCESS_TTL_MS = 24 * 60 * 60 * 1000;
const NOT_FOUND_TTL_MS = 60 * 60 * 1000;
const ERROR_TTL_MS = 5 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 8000;

const haciendaCache = new Map<
  string,
  { expiresAt: number; result: HaciendaLookupResult }
>();

function cacheResult(documento: string, result: HaciendaLookupResult) {
  const ttl = result.found
    ? SUCCESS_TTL_MS
    : result.reason === "NOT_FOUND"
      ? NOT_FOUND_TTL_MS
      : ERROR_TTL_MS;

  haciendaCache.set(documento, {
    expiresAt: Date.now() + ttl,
    result,
  });
}

function getCachedResult(documento: string) {
  const cached = haciendaCache.get(documento);

  if (!cached) return null;

  if (cached.expiresAt <= Date.now()) {
    haciendaCache.delete(documento);
    return null;
  }

  return cached.result;
}

function readText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readNestedText(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];

    if (typeof value === "string" && value.trim()) return value.trim();

    if (value && typeof value === "object" && "descripcion" in value) {
      const description = (value as { descripcion?: unknown }).descripcion;
      if (typeof description === "string" && description.trim()) {
        return description.trim();
      }
    }
  }

  return null;
}

function normalizeActivities(value: unknown): HaciendaActivity[] {
  if (!Array.isArray(value)) return [];

  const activities: HaciendaActivity[] = [];

  for (const item of value) {
      if (!item || typeof item !== "object") continue;

      const record = item as Record<string, unknown>;
      const activity = {
        codigo: readText(record.codigo),
        descripcion: readText(record.descripcion),
        estado: readText(record.estado),
      };

      if (activity.descripcion) {
        activities.push(activity);
      }
  }

  return activities;
}

function normalizeHaciendaPayload(
  documento: string,
  payload: unknown,
): HaciendaLookupResult {
  if (!payload || typeof payload !== "object") {
    return {
      found: false,
      message: "Hacienda devolvio una respuesta inesperada. Puedes completar los datos manualmente.",
      reason: "UNEXPECTED_RESPONSE",
      source: "hacienda",
    };
  }

  const record = payload as Record<string, unknown>;
  const nombre = readText(record.nombre) ?? readText(record.nombre_completo);

  if (!nombre) {
    return {
      found: false,
      message: "Hacienda devolvio una respuesta sin nombre. Puedes completar los datos manualmente.",
      reason: "UNEXPECTED_RESPONSE",
      source: "hacienda",
    };
  }

  return {
    actividades: normalizeActivities(record.actividades),
    documento,
    found: true,
    nombre,
    regimen: readNestedText(record, ["regimen", "regimenTributario"]),
    situacion: readNestedText(record, ["situacion", "situacionTributaria"]),
    source: "hacienda",
    tipoIdentificacion: readNestedText(record, [
      "tipoIdentificacion",
      "tipo_identificacion",
    ]),
  };
}

export async function lookupHaciendaContributorByDocument(
  documentoInput: string,
): Promise<HaciendaLookupResult> {
  const parsed = haciendaDocumentSchema.safeParse(documentoInput);

  if (!parsed.success) {
    return {
      found: false,
      message: "La identificacion debe tener entre 9 y 12 digitos numericos.",
      reason: "INVALID_DOCUMENT",
      source: "hacienda",
    };
  }

  const documento = parsed.data;
  const cached = getCachedResult(documento);

  if (cached) return cached;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(
      `${HACIENDA_ENDPOINT}?identificacion=${encodeURIComponent(documento)}`,
      {
        cache: "no-store",
        signal: controller.signal,
      },
    );

    if (response.status === 400) {
      const result: HaciendaLookupResult = {
        found: false,
        message: "La identificacion no tiene un formato valido para Hacienda.",
        reason: "INVALID_DOCUMENT",
        source: "hacienda",
      };
      cacheResult(documento, result);
      return result;
    }

    if (response.status === 404) {
      const result: HaciendaLookupResult = {
        found: false,
        message:
          "No encontramos esa identificacion en Hacienda. Puedes completar los datos manualmente.",
        reason: "NOT_FOUND",
        source: "hacienda",
      };
      cacheResult(documento, result);
      return result;
    }

    if (response.status === 429) {
      const result: HaciendaLookupResult = {
        found: false,
        message:
          "Hacienda limito temporalmente las consultas. Intenta mas tarde o completa los datos manualmente.",
        reason: "RATE_LIMITED",
        source: "hacienda",
      };
      cacheResult(documento, result);
      return result;
    }

    if (!response.ok) {
      const result: HaciendaLookupResult = {
        found: false,
        message:
          "No pudimos consultar Hacienda en este momento. Puedes completar los datos manualmente.",
        reason: "NETWORK_ERROR",
        source: "hacienda",
      };
      cacheResult(documento, result);
      return result;
    }

    const result = normalizeHaciendaPayload(documento, await response.json());
    cacheResult(documento, result);
    return result;
  } catch {
    const result: HaciendaLookupResult = {
      found: false,
      message:
        "No pudimos consultar Hacienda en este momento. Puedes completar los datos manualmente.",
      reason: "NETWORK_ERROR",
      source: "hacienda",
    };
    cacheResult(documento, result);
    return result;
  } finally {
    clearTimeout(timeout);
  }
}
