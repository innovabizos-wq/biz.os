import { escapeXmlText } from "@/modules/billing/xml/serialize";

export type ReceiverMessageStatus = "accepted" | "partially_accepted" | "rejected";

type ReceiverMessageInput = {
  clave: string;
  consecutive: string | null;
  detail: string | null;
  generatedAt: string;
  issuerIdentification: string | null;
  status: ReceiverMessageStatus;
  totalAmount: number | null;
};

const STATUS_CODES: Record<ReceiverMessageStatus, string> = {
  accepted: "1",
  partially_accepted: "2",
  rejected: "3",
};

function tag(name: string, value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return "";
  return `<${name}>${escapeXmlText(String(value))}</${name}>`;
}

function amount(value: number | null) {
  return typeof value === "number" && Number.isFinite(value) ? value.toFixed(5) : null;
}

export function buildReceiverMessageXml(input: ReceiverMessageInput) {
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<MensajeReceptor>`,
    tag("Clave", input.clave),
    tag("NumeroCedulaEmisor", input.issuerIdentification),
    tag("FechaEmisionDoc", input.generatedAt),
    tag("Mensaje", STATUS_CODES[input.status]),
    tag("DetalleMensaje", input.detail),
    tag("MontoTotalImpuesto", null),
    tag("TotalFactura", amount(input.totalAmount)),
    tag("NumeroConsecutivoReceptor", input.consecutive),
    `</MensajeReceptor>`,
  ].join("");
}
