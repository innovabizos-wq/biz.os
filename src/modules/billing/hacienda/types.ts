export type HaciendaEnvironment = "testing" | "production";

export type HaciendaSendResult = {
  rawResponse: unknown;
  status: "recibido" | "procesando" | "error";
};

export type HaciendaParty = {
  numeroIdentificacion: string;
  tipoIdentificacion: string;
};

export type HaciendaStatusResult = {
  rawResponse: unknown;
  responseXmlBase64?: string;
  status: "aceptado" | "rechazado" | "procesando" | "error" | "desconocido";
};

export interface HaciendaClient {
  queryStatus(clave: string): Promise<HaciendaStatusResult>;
  sendSignedXml(params: {
    clave: string;
    emisor: HaciendaParty;
    fecha: string;
    receptor?: HaciendaParty;
    signedXml: string;
  }): Promise<HaciendaSendResult>;
}
