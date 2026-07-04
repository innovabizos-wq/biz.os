import { randomInt } from "node:crypto";

const COSTA_RICA_COUNTRY_CODE = "506";
const NORMAL_SITUATION_CODE = "1";

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

function formatIssueDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error("Fecha de emision fiscal invalida.");
  }

  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const year = String(date.getUTCFullYear()).slice(-2);

  return `${day}${month}${year}`;
}

export function generateFiscalSecurityCode() {
  return String(randomInt(0, 100_000_000)).padStart(8, "0");
}

export type GenerateFiscalClaveInput = {
  consecutivo: string;
  identificationNumber: string;
  issueDate: string;
  securityCode?: string;
  situationCode?: string;
};

export function generateFiscalClave(input: GenerateFiscalClaveInput) {
  const identification = onlyDigits(input.identificationNumber);
  const consecutivo = onlyDigits(input.consecutivo);
  const securityCode = onlyDigits(input.securityCode ?? generateFiscalSecurityCode());
  const situationCode = input.situationCode ?? NORMAL_SITUATION_CODE;

  if (!identification || identification.length > 12) {
    throw new Error("Identificacion fiscal del emisor invalida para clave numerica.");
  }

  if (!/^\d{20}$/.test(consecutivo)) {
    throw new Error("Consecutivo fiscal invalido para clave numerica.");
  }

  if (!/^[123]$/.test(situationCode)) {
    throw new Error("Codigo de situacion fiscal invalido.");
  }

  if (!/^\d{8}$/.test(securityCode)) {
    throw new Error("Codigo de seguridad fiscal invalido.");
  }

  return [
    COSTA_RICA_COUNTRY_CODE,
    formatIssueDate(input.issueDate),
    identification.padStart(12, "0"),
    consecutivo,
    situationCode,
    securityCode,
  ].join("");
}
