export type HaciendaEnvironment = "testing" | "production";

export type HaciendaSendResult = {
  rawResponse: unknown;
  status: "recibido" | "procesando" | "error";
};

export type HaciendaStatusResult = {
  rawResponse: unknown;
  status: "aceptado" | "rechazado" | "procesando" | "error" | "desconocido";
};

export interface HaciendaClient {
  queryStatus(clave: string): Promise<HaciendaStatusResult>;
  sendSignedXml(params: { clave: string; signedXml: string }): Promise<HaciendaSendResult>;
}
