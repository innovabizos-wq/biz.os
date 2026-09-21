const scopes = {
  "catalog:read": "Consultar productos y servicios",
  "clients:read": "Consultar clientes",
  "fiscal_documents:read": "Consultar documentos fiscales",
  "payments:read": "Consultar cuentas y saldos",
  "sales:read": "Consultar ventas",
};

const listResponse = {
  content: {
    "application/json": {
      schema: {
        properties: {
          data: { items: { type: "object" }, type: "array" },
          meta: {
            properties: {
              hasMore: { type: "boolean" },
              limit: { maximum: 100, minimum: 1, type: "integer" },
              nextCursor: { nullable: true, type: "string" },
              resource: { type: "string" },
            },
            type: "object",
          },
          requestId: { format: "uuid", type: "string" },
        },
        required: ["data", "meta", "requestId"],
        type: "object",
      },
    },
  },
  description: "Lista paginada",
};

function listPath(summary: string, scope: keyof typeof scopes) {
  return {
    get: {
      parameters: [
        { in: "query", name: "limit", schema: { default: 50, maximum: 100, minimum: 1, type: "integer" } },
        { in: "query", name: "cursor", schema: { type: "string" } },
      ],
      responses: { "200": listResponse, "401": { description: "Clave invalida" }, "403": { description: "Scope insuficiente" }, "429": { description: "Limite excedido" } },
      security: [{ BearerApiKey: [] }, { HeaderApiKey: [] }],
      summary,
      "x-required-scope": scope,
    },
  };
}

export async function GET() {
  return Response.json({
    components: {
      securitySchemes: {
        BearerApiKey: {
          bearerFormat: "bizos_live_<prefijo>_<secreto>",
          description: "Clave creada en Configuracion > Conexiones.",
          scheme: "bearer",
          type: "http",
        },
        HeaderApiKey: {
          in: "header",
          name: "X-API-Key",
          type: "apiKey",
        },
      },
    },
    info: {
      description: "API por empresa con claves limitadas, cursor y errores estables.",
      title: "Biz.OS Public API",
      version: "1.0.0",
    },
    openapi: "3.1.0",
    "x-api-scopes": scopes,
    paths: {
      "/api/v1/catalog": listPath("Listar catalogo", "catalog:read"),
      "/api/v1/clients": listPath("Listar clientes", "clients:read"),
      "/api/v1/fiscal-documents": listPath("Listar documentos fiscales", "fiscal_documents:read"),
      "/api/v1/payments": listPath("Listar cuentas y saldos", "payments:read"),
      "/api/v1/sales": listPath("Listar ventas", "sales:read"),
    },
    servers: [{ url: "/" }],
  });
}
