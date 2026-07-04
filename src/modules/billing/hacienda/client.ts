import type {
  HaciendaClient,
  HaciendaSendResult,
  HaciendaStatusResult,
} from "@/modules/billing/hacienda/types";
import {
  describeHaciendaReadiness,
  getHaciendaRuntimeConfig,
  type HaciendaRuntimeConfig,
} from "@/modules/billing/hacienda/config";

class NotConfiguredHaciendaClient implements HaciendaClient {
  constructor(private readonly config: HaciendaRuntimeConfig = getHaciendaRuntimeConfig()) {}

  async queryStatus(): Promise<HaciendaStatusResult> {
    if (!this.config.statusEnabled) {
      throw new Error(
        "Cliente Hacienda no configurado: BILLING_HACIENDA_STATUS_ENABLED debe estar en true para consultar estado.",
      );
    }

    throw new Error(
      `Cliente Hacienda no configurado: no se puede consultar estado sin integracion real OAuth. ${describeHaciendaReadiness(this.config)}`,
    );
  }

  async sendSignedXml(): Promise<HaciendaSendResult> {
    if (!this.config.sendEnabled) {
      throw new Error(
        "Cliente Hacienda no configurado: BILLING_HACIENDA_SEND_ENABLED debe estar en true para enviar XML.",
      );
    }

    throw new Error(
      `Cliente Hacienda no configurado: no se puede enviar XML sin OAuth y endpoint real. ${describeHaciendaReadiness(this.config)}`,
    );
  }
}

export function getHaciendaClient(): HaciendaClient {
  return new NotConfiguredHaciendaClient();
}
