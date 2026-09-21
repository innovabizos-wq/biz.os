import "server-only";

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

function isPrivateAddress(address: string) {
  const normalized = address.toLowerCase();
  if (normalized === "::1" || normalized.startsWith("fe80:") || normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
  const parts = normalized.split(".").map(Number);
  if (parts.length !== 4 || parts.some(Number.isNaN)) return false;
  return parts[0] === 10
    || parts[0] === 127
    || (parts[0] === 169 && parts[1] === 254)
    || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)
    || (parts[0] === 192 && parts[1] === 168)
    || parts[0] === 0;
}

export async function assertSafeExternalUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password) {
    throw new Error("La conexión REST debe usar HTTPS y no incluir credenciales en la URL.");
  }
  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new Error("El destino REST no puede ser una dirección interna.");
  }
  const addresses = isIP(host)
    ? [{ address: host }]
    : await lookup(host, { all: true, verbatim: true });
  if (addresses.length === 0 || addresses.some((entry) => isPrivateAddress(entry.address))) {
    throw new Error("El destino REST resuelve a una red privada o no autorizada.");
  }
  return url;
}

export async function safeExternalFetch(
  value: string,
  init: RequestInit = {},
  timeoutMs = 10_000,
) {
  const url = await assertSafeExternalUrl(value);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.min(20_000, Math.max(1_000, timeoutMs)));
  try {
    const response = await fetch(url, {
      ...init,
      cache: "no-store",
      redirect: "manual",
      signal: controller.signal,
    });
    if (response.status >= 300 && response.status < 400) {
      throw new Error("El proveedor intentó redirigir la verificación a un destino no autorizado.");
    }
    return response;
  } finally {
    clearTimeout(timeout);
  }
}
