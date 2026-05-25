export function assertMetaClientNotImplemented(): never {
  throw new Error(
    "Meta API client is intentionally disabled in this phase. No real messages are sent.",
  );
}

export async function sendMetaMessagePlaceholder(): Promise<never> {
  return assertMetaClientNotImplemented();
}
