import { publicApiSuccess } from "@/modules/public-api/responses";

export const dynamic = "force-dynamic";

export async function GET() {
  const requestId = crypto.randomUUID();
  return publicApiSuccess(
    requestId,
    {
      documentation: "/api/v1/openapi.json",
      resources: ["clients", "catalog", "sales", "payments", "fiscal-documents"],
      version: "v1",
    },
    {},
  );
}
