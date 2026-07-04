import "server-only";

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { appendFileSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ALGORITHM = "aes-256-gcm";

function readLocalAiEncryptionKey() {
  try {
    const envLocal = readFileSync(join(process.cwd(), ".env.local"), "utf8");
    const line = envLocal
      .split(/\r?\n/)
      .find((entry) => entry.startsWith("AI_SETTINGS_ENCRYPTION_KEY="));

    return line?.slice("AI_SETTINGS_ENCRYPTION_KEY=".length).trim() || null;
  } catch {
    return null;
  }
}

function ensureLocalAiEncryptionKey() {
  if (process.env.NODE_ENV === "production") return null;

  const existing = readLocalAiEncryptionKey();
  if (existing) return existing;

  try {
    const secret = randomBytes(32).toString("base64");
    appendFileSync(
      join(process.cwd(), ".env.local"),
      `\nAI_SETTINGS_ENCRYPTION_KEY=${secret}\n`,
      "utf8",
    );

    process.env.AI_SETTINGS_ENCRYPTION_KEY = secret;
    return secret;
  } catch {
    return null;
  }
}

function getKey() {
  const secret =
    process.env.AI_SETTINGS_ENCRYPTION_KEY ||
    process.env.FISCAL_CONFIG_ENCRYPTION_KEY ||
    readLocalAiEncryptionKey() ||
    ensureLocalAiEncryptionKey() ||
    (process.env.NODE_ENV !== "production"
      ? "biz.os-local-development-ai-settings-encryption-key"
      : null);

  if (!secret) {
    throw new Error("Missing server encryption secret for AI settings.");
  }

  return createHash("sha256").update(secret).digest();
}

export function encryptAiSecret(value: string | null | undefined) {
  if (!value) return null;

  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString("base64")}.${authTag.toString("base64")}.${encrypted.toString("base64")}`;
}

export function decryptAiSecret(value: string | null | undefined) {
  if (!value) return null;

  const [iv, authTag, encrypted] = value.split(".");
  if (!iv || !authTag || !encrypted) return null;

  const decipher = createDecipheriv(ALGORITHM, getKey(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(authTag, "base64"));

  return Buffer.concat([
    decipher.update(Buffer.from(encrypted, "base64")),
    decipher.final(),
  ]).toString("utf8");
}
