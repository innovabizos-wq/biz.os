import "server-only";

import { createHash } from "node:crypto";

export function paymentOperationIdFromKey(parts: string[]) {
  const hex = createHash("sha256")
    .update(parts.join("\u001f"), "utf8")
    .digest("hex")
    .slice(0, 32)
    .split("");

  hex[12] = "5";
  hex[16] = ["8", "9", "a", "b"][Number.parseInt(hex[16] ?? "0", 16) % 4];

  const value = hex.join("");
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}
