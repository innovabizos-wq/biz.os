import type { CrmCustomer } from "@/modules/crm/types";

export type ConsultationSource = "internal" | "hacienda" | "manual";

export type ConsultationIntent = "save" | "quote";

export type HaciendaActivity = {
  codigo?: string | null;
  descripcion?: string | null;
  estado?: string | null;
};

export type HaciendaLookupResult =
  | {
      actividades: HaciendaActivity[];
      documento: string;
      found: true;
      nombre: string;
      regimen?: string | null;
      situacion?: string | null;
      source: "hacienda";
      tipoIdentificacion?: string | null;
    }
  | {
      found: false;
      message: string;
      reason:
        | "INVALID_DOCUMENT"
        | "NETWORK_ERROR"
        | "NOT_FOUND"
        | "RATE_LIMITED"
        | "UNEXPECTED_RESPONSE";
      source: "hacienda";
    };

export type ConsultationSearchResult =
  | {
      cliente: CrmCustomer;
      documento: string;
      source: "internal";
      tipoAutomatico: CrmCustomer["tipo"];
    }
  | {
      hacienda: Extract<HaciendaLookupResult, { found: true }>;
      source: "hacienda";
    }
  | {
      documento: string;
      message: string;
      source: "manual";
    };
