import "server-only";

import { createHmac, timingSafeEqual } from "crypto";

export type MetaSignedRequest = {
  algorithm?: string;
  issued_at?: number;
  user_id?: string;
};

export function verifyMetaSignedRequest(value: string, appSecret: string) {
  const [encodedSignature, encodedPayload] = value.split(".");
  if (!encodedSignature || !encodedPayload) return null;

  const actual = Buffer.from(encodedSignature, "base64url");
  const expected = createHmac("sha256", appSecret).update(encodedPayload).digest();
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as MetaSignedRequest;
    if (payload.algorithm?.toUpperCase() !== "HMAC-SHA256" || !payload.user_id) return null;
    return payload;
  } catch {
    return null;
  }
}
