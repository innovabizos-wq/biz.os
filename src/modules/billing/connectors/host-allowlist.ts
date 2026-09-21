export function ensureAllowedRestHost(baseUrl: string) {
  const hostname = new URL(baseUrl).hostname.toLowerCase();
  const allowed = (process.env.BILLING_REST_ALLOWED_HOSTS ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  if (!allowed.includes(hostname)) {
    throw new Error("El dominio REST debe ser autorizado primero por el operador de Biz.OS.");
  }
}
