import type { HaciendaEnvironment } from "@/modules/billing/hacienda/types";

type HaciendaEnvValue = "production" | "produccion" | "pruebas" | "testing";

export type HaciendaRuntimeConfig = {
  apiUrl: string | null;
  authUrl: string | null;
  clientId: "api-prod" | "api-stag";
  environment: HaciendaEnvironment;
  missingKeys: string[];
  sendEnabled: boolean;
  statusEnabled: boolean;
};

const OFFICIAL_ENDPOINTS = {
  production: {
    api: "https://api.comprobanteselectronicos.go.cr/recepcion/v1",
    auth: "https://idp.comprobanteselectronicos.go.cr/auth/realms/rut/protocol/openid-connect/token",
    clientId: "api-prod",
  },
  testing: {
    api: "https://api.comprobanteselectronicos.go.cr/recepcion-sandbox/v1",
    auth: "https://idp.comprobanteselectronicos.go.cr/auth/realms/rut-stag/protocol/openid-connect/token",
    clientId: "api-stag",
  },
} as const;

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

export function getHaciendaRuntimeConfig(requestedEnvironment?: HaciendaEnvironment): HaciendaRuntimeConfig {
  const environment = requestedEnvironment ?? normalizeEnvironment(envText("HACIENDA_ENVIRONMENT"));
  const official = OFFICIAL_ENDPOINTS[environment];
  const authKey = environment === "production" ? "HACIENDA_PROD_AUTH_URL" : "HACIENDA_TEST_AUTH_URL";
  const apiKey = environment === "production" ? "HACIENDA_PROD_API_URL" : "HACIENDA_TEST_API_URL";
  const authUrl = envText(authKey) ?? official.auth;
  const apiUrl = envText(apiKey) ?? official.api;

  return {
    apiUrl,
    authUrl,
    clientId: official.clientId,
    environment,
    missingKeys: [],
    sendEnabled: envFlag("BILLING_HACIENDA_SEND_ENABLED"),
    statusEnabled: envFlag("BILLING_HACIENDA_STATUS_ENABLED"),
  };
}

export function describeHaciendaReadiness(config = getHaciendaRuntimeConfig()) {
  if (!config.sendEnabled && !config.statusEnabled) {
    return "Hacienda deshabilitado por flags BILLING_HACIENDA_SEND_ENABLED/BILLING_HACIENDA_STATUS_ENABLED.";
  }

  return `Cliente Hacienda directo habilitado para ${config.environment}.`;
}

export function assertHaciendaOperationEnabled(
  operation: "send" | "status",
  environment?: HaciendaEnvironment,
) {
  const config = getHaciendaRuntimeConfig(environment);
  const enabled = operation === "send" ? config.sendEnabled : config.statusEnabled;
  if (!enabled) {
    const flag = operation === "send"
      ? "BILLING_HACIENDA_SEND_ENABLED"
      : "BILLING_HACIENDA_STATUS_ENABLED";
    throw new Error(`La operacion con Hacienda esta deshabilitada por ${flag}.`);
  }
  return config;
}
