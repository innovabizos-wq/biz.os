import type { FiscalDocumentDetail } from "@/modules/billing/queries";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value : "No registrado";
}

function formatMoney(value: unknown) {
  return typeof value === "number" ? value.toLocaleString("es-CR") : "No calculado";
}

function fiscalStatusLabel(document: FiscalDocumentDetail) {
  if (document.haciendaStatus === "aceptado" && document.status === "accepted") {
    return "Aceptado por Hacienda";
  }

  if (document.haciendaStatus === "rechazado" || document.status === "rejected") {
    return "Rechazado por Hacienda";
  }

  return "Pendiente de aceptacion oficial";
}

export function buildFiscalPrintableRepresentation(document: FiscalDocumentDetail) {
  const issuerName = text(document.issuerSnapshot.legalName);
  const issuerIdentification = text(document.issuerSnapshot.identificationNumber);
  const total = formatMoney(document.totals.totalComprobante ?? document.totals.total);
  const subtotal = formatMoney(document.totals.subtotal);
  const tax = formatMoney(document.totals.totalImpuesto ?? document.totals.tax);
  const statusLabel = fiscalStatusLabel(document);

  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <title>Representacion grafica fiscal ${escapeHtml(document.consecutivo ?? document.id)}</title>
    <style>
      body { color: #0f172a; font-family: Arial, sans-serif; margin: 32px; }
      .header { border-bottom: 2px solid #0f172a; margin-bottom: 24px; padding-bottom: 16px; }
      .notice { background: #fef3c7; border: 1px solid #f59e0b; padding: 12px; }
      .grid { display: grid; gap: 12px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .box { border: 1px solid #cbd5e1; padding: 12px; }
      .label { color: #475569; font-size: 12px; text-transform: uppercase; }
      .value { font-size: 16px; font-weight: 700; margin-top: 4px; }
      .totals { margin-top: 24px; width: 100%; }
      .totals td { border-bottom: 1px solid #e2e8f0; padding: 8px 0; }
      .right { text-align: right; }
    </style>
  </head>
  <body>
    <section class="header">
      <h1>Representacion grafica fiscal</h1>
      <p class="notice">La factura electronica real es el XML firmado y aceptado por Hacienda. Este documento es una representacion grafica y muestra el estado fiscal actual: ${escapeHtml(statusLabel)}.</p>
    </section>
    <section class="grid">
      <div class="box">
        <div class="label">Emisor</div>
        <div class="value">${escapeHtml(issuerName)}</div>
        <div>${escapeHtml(issuerIdentification)}</div>
      </div>
      <div class="box">
        <div class="label">Receptor</div>
        <div class="value">${escapeHtml(document.receiverName ?? "Sin receptor")}</div>
      </div>
      <div class="box">
        <div class="label">Clave</div>
        <div class="value">${escapeHtml(document.clave ?? "Pendiente")}</div>
      </div>
      <div class="box">
        <div class="label">Consecutivo</div>
        <div class="value">${escapeHtml(document.consecutivo ?? "Pendiente")}</div>
      </div>
      <div class="box">
        <div class="label">Tipo</div>
        <div class="value">${escapeHtml(document.documentTypeCode)}</div>
      </div>
      <div class="box">
        <div class="label">Estado Hacienda</div>
        <div class="value">${escapeHtml(statusLabel)}</div>
      </div>
    </section>
    <table class="totals">
      <tr><td>Subtotal</td><td class="right">${escapeHtml(subtotal)}</td></tr>
      <tr><td>Impuestos</td><td class="right">${escapeHtml(tax)}</td></tr>
      <tr><td><strong>Total comprobante</strong></td><td class="right"><strong>${escapeHtml(total)}</strong></td></tr>
    </table>
  </body>
</html>`;
}
