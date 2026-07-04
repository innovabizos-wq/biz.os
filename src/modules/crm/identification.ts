const CRM_IDENTIFICATION_PATTERN = /^\d{9,12}$/;

export function normalizeCrmIdentification(value: string | null | undefined) {
  const normalized = (value ?? "").trim().replace(/[^\d]/g, "");

  return normalized;
}

export function isValidCrmIdentification(value: string) {
  return CRM_IDENTIFICATION_PATTERN.test(value);
}

export function getNormalizedCrmIdentificationOrNull(
  value: string | null | undefined,
) {
  const normalized = normalizeCrmIdentification(value);

  if (!normalized) {
    return null;
  }

  return isValidCrmIdentification(normalized) ? normalized : null;
}
