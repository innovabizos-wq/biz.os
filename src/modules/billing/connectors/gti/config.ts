import "server-only";

export type GtiEnvironment = "testing" | "production";

const OFFICIAL_PRODUCTION_DOCUMENT_URL =
  "https://www.recaudoenlinea.co.cr/API_WooCommerce/api/Documentos/CargarDocumento";
const OFFICIAL_PRODUCTION_SERVICE_URL =
  "https://www.facturaelectronica.cr/ServicioCargaFactura/GTICargaFactura.asmx";
const OFFICIAL_TEST_SERVICE_URL =
  "https://pruebas.gticr.com/AplicacionFEPruebas/WSCargaFactura/Pruebas/GTICargaFactura.asmx";

function envText(key: string) {
  const value = process.env[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function getGtiRuntimeConfig(environment: GtiEnvironment) {
  const suffix = environment === "production" ? "PROD" : "TEST";
  return {
    documentUrl:
      envText(`GTI_${suffix}_DOCUMENT_URL`) ??
      (environment === "production" ? OFFICIAL_PRODUCTION_DOCUMENT_URL : null),
    serviceUrl:
      envText(`GTI_${suffix}_SERVICE_URL`) ??
      (environment === "production"
        ? OFFICIAL_PRODUCTION_SERVICE_URL
        : OFFICIAL_TEST_SERVICE_URL),
  };
}
