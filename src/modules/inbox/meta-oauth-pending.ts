import "server-only";

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

export const META_OAUTH_PENDING_COOKIE = "bizos_meta_oauth_pending";
export const META_OAUTH_PENDING_MAX_AGE_MS = 10 * 60 * 1000;

export type PendingMetaPage = {
  accessToken: string;
  grantedScopes: string[];
  id: string;
  instagramBusinessAccount?: { id: string; username?: string };
  name: string;
  tokenExpiresAt: string | null;
};

export type PendingMetaConnection = {
  empresaId: string;
  issuedAt: number;
  metaUserId: string;
  pages: PendingMetaPage[];
  profileId: string;
  provider: "facebook" | "instagram";
};

function encryptionKey() {
  const secret = process.env.META_OAUTH_STATE_SECRET?.trim();
  if (!secret) throw new Error("Missing META_OAUTH_STATE_SECRET.");
  return createHash("sha256").update(secret).digest();
}

export function encryptPendingMetaConnection(value: PendingMetaConnection) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(value), "utf8"),
    cipher.final(),
  ]);

  return `${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decryptPendingMetaConnection(value: string | undefined) {
  if (!value) return null;
  const [iv, tag, encrypted] = value.split(".");
  if (!iv || !tag || !encrypted) return null;

  try {
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    const parsed = JSON.parse(
      Buffer.concat([
        decipher.update(Buffer.from(encrypted, "base64url")),
        decipher.final(),
      ]).toString("utf8"),
    ) as PendingMetaConnection;

    if (
      !["facebook", "instagram"].includes(parsed.provider) ||
      !Array.isArray(parsed.pages) ||
      !parsed.empresaId ||
      !parsed.metaUserId ||
      !parsed.profileId ||
      !Number.isFinite(parsed.issuedAt)
    ) return null;

    return parsed;
  } catch {
    return null;
  }
}

export function isPendingMetaConnectionExpired(
  value: PendingMetaConnection,
  currentTime = Date.now(),
) {
  return currentTime - value.issuedAt > META_OAUTH_PENDING_MAX_AGE_MS;
}
