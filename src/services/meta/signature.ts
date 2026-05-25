const SIGNATURE_PREFIX = "sha256=";

export function getMetaSignature(headers: Headers) {
  return headers.get("x-hub-signature-256");
}

export function isMetaSignatureFormat(value: string | null) {
  return Boolean(value?.toLowerCase().startsWith(SIGNATURE_PREFIX));
}

export function canSkipMetaSignature() {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.META_WEBHOOK_SKIP_SIGNATURE === "true"
  );
}
