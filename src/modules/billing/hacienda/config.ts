import type { HaciendaEnvironment } from "@/modules/billing/hacienda/types";

type HaciendaEnvValue = "production" | "produccion" | "pruebas" | "testing";

export type HaciendaRuntimeConfig = {
  apiUrl: string | null;
  authUrl: string | null;
  environment: HaciendaEnvironment;
  missingKeys: string[];
  sendEnabled: boolean;
  statusEnabled: boolean;
};

function envText(key: string) {
  const value = process.env[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function envFlag(key: string) {
  return envText(key) === "true";
}

function normalizeEnvironment(value: string | null): HaciendaEnvironment {
  const normalized = (value ?? "pruebas").toLowerCase() as HaciendaEnvValue;
  return normalized === "production" || normalized === "produccion" ? "production" : "testing";
}

export function getHaciendaRuntimeConfig(): HaciendaRuntimeConfig {
  const environment = normalizeEnvironment(envText("HACIENDA_ENVIRONMENT"));
  const authKey = environment === "production" ? "HACIENDA_PROD_AUTH_URL" : "HACIENDA_TEST_AUTH_URL";
  const apiKey = environment === "production" ? "HACIENDA_PROD_API_URL" : "HACIENDA_TEST_API_URL";
  const authUrl = envText(authKey);
  const apiUrl = envText(apiKey);
  const missingKeys = [
    !authUrl ? authKey : null,
    !apiUrl ? apiKey : null,
  ].filter((key): key is string => Boolean(key));

  return {
    apiUrl,
    authUrl,
    environment,
    missingKeys,
    sendEnabled: envFlag("BILLING_HACIENDA_SEND_ENABLED"),
    statusEnabled: envFlag("BILLING_HACIENDA_STATUS_ENABLED"),
  };
}

export function describeHaciendaReadiness(config = getHaciendaRuntimeConfig()) {
  if (!config.sendEnabled && !config.statusEnabled) {
    return "Hacienda deshabilitado por flags BILLING_HACIENDA_SEND_ENABLED/BILLING_HACIENDA_STATUS_ENABLED.";
  }

  if (config.missingKeys.length) {
    return `Configuracion Hacienda incompleta: faltan ${config.missingKeys.join(", ")}.`;
  }

  return "Configuracion Hacienda presente; falta adaptador OAuth/payload validado contra endpoints oficiales.";
}
