import type { FiscalDocumentDetail } from "@/modules/billing/queries";

export type GtiDocumentPayload = {
  Documentos: Array<{
    Encabezado: Record<string, unknown>;
    Lineas: Array<Record<string, unknown>>;
  }>;
  NumCuenta: string;
};

const UNIT_CODES: Record<string, number> = {
  Unid: 1,
  kg: 2,
  Oz: 4,
  L: 5,
  gal: 7,
  m: 10,
  min: 12,
  h: 13,
  d: 14,
  mL: 19,
  g: 20,
  t: 23,
  Sp: 24,
  s: 25,
  A: 26,
  K: 27,
  mol: 28,
  cd: 29,
  "m²": 30,
  "m³": 31,
  km: 91,
  in: 92,
  cm: 93,
  mm: 94,
};

function text(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function nested(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function requiredText(value: string | null, message: string) {
  if (!value) throw new Error(message);
  return value;
}

function numericCode(value: string | null, fallback?: string) {
  const selected = value ?? fallback;
  if (!selected || !/^\d+$/.test(selected)) return null;
  return String(Number(selected));
}

function gtiCurrency(code: string) {
  if (code === "CRC") return 1;
  if (code === "USD") return 2;
  throw new Error(`GTI solo tiene homologadas las monedas CRC y USD; se recibió ${code}.`);
}

function gtiDocumentType(code: string) {
  if (code === "01") return "1";
  if (code === "04") return "4";
  throw new Error("GTI tiene homologadas inicialmente la factura y el tiquete electrónicos.");
}

function receiver(document: FiscalDocumentDetail) {
  const snapshot = document.receiverSnapshot;
  const address = nested(snapshot, "address");
  const identification = text(snapshot, "identificationNumber");
  const identificationType = numericCode(
    document.receiverIdentificationType ?? text(snapshot, "identificationType"),
  );
  if (document.documentTypeCode === "01" && (!identification || !identificationType)) {
    throw new Error("La factura para GTI requiere tipo y número de identificación del receptor.");
  }
  const value: Record<string, unknown> = {
    Nombre: requiredText(document.receiverName ?? text(snapshot, "name"), "Falta el nombre del receptor para GTI."),
    TipoIdent: identificationType ?? "0",
    Identificacion: identification ?? "",
    Correo: document.receiverEmail ?? text(snapshot, "email") ?? "",
    Provincia: text(address, "provinceCode") ?? "",
    Canton: text(address, "cantonCode") ?? "",
    Distrito: text(address, "districtCode") ?? "",
    Direccion: text(address, "addressLine") ?? "",
  };
  const phone = text(snapshot, "phone")?.replace(/\D/g, "");
  if (phone) {
    value.AreaTelefono = phone.length > 8 ? phone.slice(0, phone.length - 8) : "506";
    value.NumTelefono = phone.slice(-8);
  }
  return value;
}

function payments(document: FiscalDocumentDetail) {
  const source = document.payments.length
    ? document.payments.map((payment) => payment.paymentMethodCode)
    : [text(document.issuerSnapshot, "defaultPaymentMethodCode") ?? "01"];
  return [...new Set(source)].map((code) => {
    const normalized = numericCode(code);
    if (!normalized || !["1", "2", "3", "4", "5", "99"].includes(normalized)) {
      throw new Error(`El medio de pago ${code} no tiene correspondencia GTI homologada.`);
    }
    return normalized === "99"
      ? { MedioPagoOtros: "Otro medio registrado en Biz.OS", TipoMedioPago: normalized }
      : { TipoMedioPago: normalized };
  });
}

function linePayload(document: FiscalDocumentDetail) {
  return document.lines.map((line) => {
    const cabys = requiredText(line.cabysCode, `La línea ${line.lineNumber} no tiene CABYS.`);
    if (!/^\d{13}$/.test(cabys)) {
      throw new Error(`El CABYS de la línea ${line.lineNumber} debe tener 13 dígitos.`);
    }
    const unit = UNIT_CODES[line.unitCode];
    if (!unit) {
      throw new Error(`La unidad ${line.unitCode} de la línea ${line.lineNumber} no tiene correspondencia GTI homologada.`);
    }
    const taxes = line.taxes.map((tax) => {
      const taxCode = numericCode(tax.taxCode);
      if (!taxCode || !["1", "2", "3", "4", "5", "6", "7", "8", "12", "99"].includes(taxCode)) {
        throw new Error(`El impuesto ${tax.taxCode} de la línea ${line.lineNumber} no está homologado con GTI.`);
      }
      const value: Record<string, unknown> = {
        CodigoImp: Number(taxCode),
        MontoImp: tax.amount,
        PorcentajeImp: tax.rate ?? 0,
      };
      if (tax.taxRateCode) {
        const rateCode = numericCode(tax.taxRateCode);
        if (!rateCode || Number(rateCode) < 1 || Number(rateCode) > 11) {
          throw new Error(`La tarifa ${tax.taxRateCode} de la línea ${line.lineNumber} no está homologada con GTI.`);
        }
        value.CodigoTarifa = Number(rateCode);
      }
      return value;
    });
    const value: Record<string, unknown> = {
      BaseImponible: line.taxableBase ?? line.subtotal,
      Cantidad: line.quantity,
      Codigo: cabys,
      Descripcion: requiredText(line.detail?.trim() || null, `La línea ${line.lineNumber} no tiene descripción.`),
      FormaFarmaceutica: "",
      Impuestos: taxes,
      PrecioUnitario: line.unitPrice,
      RegistroMedicamento: "",
      TipoTransaccion: "1",
      UnidadMedida: unit,
    };
    if (line.discountAmount > 0) {
      value.Descuentos = [{ MontoDescuento: line.discountAmount, NaturalezaDescuento: "Descuento comercial" }];
    }
    return value;
  });
}

export function buildGtiDocumentPayload(
  document: FiscalDocumentDetail,
  accountNumber: string,
): GtiDocumentPayload {
  if (document.status !== "validated") {
    throw new Error("GTI solo puede recibir un documento fiscal validado.");
  }
  if (!/^\d+$/.test(accountNumber)) throw new Error("El número de cuenta GTI debe ser numérico.");
  const activityCode = requiredText(
    text(document.issuerSnapshot, "activityCode"),
    "Falta el código de actividad económica para GTI.",
  );
  if (!/^\d{6}$/.test(activityCode)) throw new Error("La actividad económica para GTI debe tener 6 dígitos.");
  const saleCondition = numericCode(document.saleConditionCode, "01");
  if (!saleCondition) throw new Error("La condición de venta no tiene un código GTI válido.");

  return {
    NumCuenta: accountNumber,
    Documentos: [{
      Encabezado: {
        CodigoActividad: activityCode,
        CondicionVenta: saleCondition,
        Emisor: { Registrofiscal8707: 0 },
        MedioPagos: payments(document),
        Moneda: gtiCurrency(document.currencyCode),
        Receptor: receiver(document),
        SituacionEnvio: "1",
        Sucursal: numericCode(document.branchCode, "001") ?? "1",
        Terminal: numericCode(document.terminalCode, "00001") ?? "1",
        TipoDoc: gtiDocumentType(document.documentTypeCode),
      },
      Lineas: linePayload(document),
    }],
  };
}
